#!/usr/bin/env bash
# One-time bootstrap for .github/workflows/ci-cd.yml. Run from the repo root on a machine with gcloud + gh logged in.
set -euo pipefail

PROJECT=${PROJECT:-vph-legacy}
ZONE=${ZONE:-asia-southeast1-b}
VM=${VM:-giabaco-guniform}
SSH_USER=${SSH_USER:-minhquana}
REPO=${REPO:-minhquana1906/giabaco-order-management-system}
PUBLIC_HOST=${PUBLIC_HOST:-giabaco.samocdigital.com}
ADMIN_HOST=${ADMIN_HOST:-giabaco-admin.samocdigital.com}
SA_NAME=guniform-deploy
POOL=github
PROVIDER=guniform-repo

SA="$SA_NAME@$PROJECT.iam.gserviceaccount.com"
PNUM=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')
g() { gcloud --project "$PROJECT" --quiet "$@"; }

echo "== APIs"
g services enable iap.googleapis.com iamcredentials.googleapis.com sts.googleapis.com

echo "== Service account and Workload Identity Federation"
g iam service-accounts describe "$SA" >/dev/null 2>&1 || g iam service-accounts create "$SA_NAME" --display-name="G-UNIFORM GitHub deploy"
g iam workload-identity-pools describe "$POOL" --location=global >/dev/null 2>&1 \
  || g iam workload-identity-pools create "$POOL" --location=global --display-name="GitHub Actions"
g iam workload-identity-pools providers describe "$PROVIDER" --location=global --workload-identity-pool="$POOL" >/dev/null 2>&1 \
  || g iam workload-identity-pools providers create-oidc "$PROVIDER" --location=global --workload-identity-pool="$POOL" \
    --issuer-uri=https://token.actions.githubusercontent.com \
    --attribute-mapping=google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref \
    --attribute-condition="assertion.repository=='$REPO' && assertion.ref=='refs/heads/main'"
g iam service-accounts add-iam-policy-binding "$SA" --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$PNUM/locations/global/workloadIdentityPools/$POOL/attribute.repository/$REPO" >/dev/null
g projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$SA" --role=roles/compute.viewer --condition=None >/dev/null
VM_IP=$(g compute instances describe "$VM" --zone "$ZONE" --format='value(networkInterfaces[0].networkIP)')
g projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$SA" --role=roles/iap.tunnelResourceAccessor \
  --condition="expression=destination.ip == \"$VM_IP\" && destination.port == 22,title=guniform-ssh-only" >/dev/null

echo "== Deploy key (restricted to IAP source and the deploy script)"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"; [ -n "${tunnel:-}" ] && kill "$tunnel" 2>/dev/null || true' EXIT
ssh-keygen -q -t ed25519 -N "" -C github-deploy -f "$tmp/key"
line="restrict,from=\"35.235.240.0/20\",command=\"\$HOME/guniform/scripts/deploy.sh\" $(cat "$tmp/key.pub")"
g compute scp scripts/deploy.sh "$SSH_USER@$VM:~/deploy.sh" --zone "$ZONE" --tunnel-through-iap
g compute ssh "$SSH_USER@$VM" --zone "$ZONE" --tunnel-through-iap --command "set -e
  mkdir -p ~/guniform/scripts && install -m 755 ~/deploy.sh ~/guniform/scripts/deploy.sh && rm ~/deploy.sh
  grep -v ' github-deploy\$' ~/.ssh/authorized_keys > ~/.ssh/ak.tmp || true
  printf '%s\n' '$line' >> ~/.ssh/ak.tmp && install -m 600 ~/.ssh/ak.tmp ~/.ssh/authorized_keys && rm ~/.ssh/ak.tmp
  cd ~/guniform
  if grep -q '^ADMIN_HOST=' .env; then sed -i 's|^ADMIN_HOST=.*|ADMIN_HOST=$ADMIN_HOST|' .env; else printf '\nADMIN_HOST=%s\n' '$ADMIN_HOST' >> .env; fi
  grep '^ADMIN_HOST=' .env"

echo "== Pin VM host key"
g compute start-iap-tunnel "$VM" 22 --local-host-port=localhost:2222 --zone "$ZONE" > "$tmp/iap.log" 2>&1 &
tunnel=$!
for _ in $(seq 30); do nc -z localhost 2222 && break; sleep 1; done
ssh-keyscan -p 2222 -t ed25519 localhost 2>/dev/null > "$tmp/known_hosts"
test -s "$tmp/known_hosts"

echo "== GitHub secrets (environment production) and variables ($REPO)"
gh api -X PUT "repos/$REPO/environments/production" >/dev/null
gh secret set DEPLOY_SSH_KEY -R "$REPO" --env production < "$tmp/key"
gh secret set DEPLOY_KNOWN_HOSTS -R "$REPO" --env production < "$tmp/known_hosts"
gh secret set GCP_DEPLOY_SA -R "$REPO" --env production --body "$SA"
gh secret set GCP_WIF_PROVIDER -R "$REPO" --env production --body "projects/$PNUM/locations/global/workloadIdentityPools/$POOL/providers/$PROVIDER"
gh variable set GCP_PROJECT -R "$REPO" --body "$PROJECT"
gh variable set GCE_ZONE -R "$REPO" --body "$ZONE"
gh variable set GCE_VM -R "$REPO" --body "$VM"
gh variable set GCE_SSH_USER -R "$REPO" --body "$SSH_USER"
gh variable set PUBLIC_HOST -R "$REPO" --body "$PUBLIC_HOST"
gh variable set ADMIN_HOST -R "$REPO" --body "$ADMIN_HOST"

echo "done: merge to main (or run the workflow manually) to deploy"
