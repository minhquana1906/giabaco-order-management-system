"""Staff account management CLI: python -m app.features.auth.staff <command>."""

import argparse
import asyncio
import getpass
import re
import sys
from collections.abc import Sequence
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import SessionLocal, engine
from app.core.security import hash_password
from app.features.auth.models import StaffAccount

USERNAME_RE = re.compile(r"[a-z0-9._-]{3,32}")
MIN_PASSWORD_LENGTH = 8


class StaffError(Exception):
    """A failed staff operation; the message is safe to print."""

    def __init__(self, message: str, code: int = 1) -> None:
        super().__init__(message)
        self.code = code


def validate_username(username: str) -> None:
    if not USERNAME_RE.fullmatch(username):
        raise StaffError("username must match [a-z0-9._-]{3,32}", 2)
    if username == get_settings().admin_username:
        raise StaffError("username is reserved for the admin account", 2)


def validate_password(password: str) -> None:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise StaffError(f"password must be at least {MIN_PASSWORD_LENGTH} characters", 2)


async def _get(session: AsyncSession, username: str) -> StaffAccount:
    staff = await session.scalar(select(StaffAccount).where(StaffAccount.username == username))
    if staff is None:
        raise StaffError(f"no such staff account: {username}")
    return staff


async def add_staff(session: AsyncSession, username: str, password: str) -> None:
    validate_username(username)
    validate_password(password)
    session.add(StaffAccount(username=username, password_hash=hash_password(password)))
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise StaffError(f"staff account already exists: {username}") from None


async def set_password(session: AsyncSession, username: str, password: str) -> None:
    validate_password(password)
    (await _get(session, username)).password_hash = hash_password(password)
    await session.commit()


async def set_disabled(session: AsyncSession, username: str, disabled: bool) -> None:
    (await _get(session, username)).disabled_at = datetime.now(UTC) if disabled else None
    await session.commit()


async def list_staff(session: AsyncSession) -> list[tuple[str, str, datetime]]:
    rows = await session.scalars(select(StaffAccount).order_by(StaffAccount.created_at))
    return [(s.username, "disabled" if s.disabled_at else "active", s.created_at) for s in rows]


def read_password() -> str:
    if sys.stdin.isatty():
        password = getpass.getpass("Password: ")
        if password != getpass.getpass("Repeat: "):
            raise StaffError("passwords differ", 2)
        return password
    return sys.stdin.readline().rstrip("\r\n")


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python -m app.features.auth.staff")
    commands = parser.add_subparsers(dest="command", required=True)
    for name in ("add", "passwd", "disable", "enable"):
        commands.add_parser(name).add_argument("username")
    commands.add_parser("list")
    return parser


async def _run(command: str, username: str | None) -> None:
    async with SessionLocal() as session:
        if command == "list":
            for name, status, created_at in await list_staff(session):
                print(f"{name}\t{status}\t{created_at.isoformat()}")
        elif username is None:
            raise StaffError("username required", 2)
        elif command == "add":
            await add_staff(session, username, read_password())
        elif command == "passwd":
            await set_password(session, username, read_password())
        else:
            await set_disabled(session, username, command == "disable")
    await engine.dispose()


def main(argv: Sequence[str]) -> int:
    args = _parser().parse_args(argv)
    try:
        asyncio.run(_run(args.command, getattr(args, "username", None)))
    except StaffError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return exc.code
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
