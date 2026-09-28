"""
Read-only admin report: how many users there are, with each one's email.

Emails are encrypted in the database (app/core/crypto.py), so this needs the
same DATABASE_URL and DATA_ENCRYPTION_KEY as the running backend — e.g. put
production's values in backend/.env (or export them) and run, from backend/
with the venv active:

    python -m scripts.list_users

Prints to the terminal only; nothing is written anywhere.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.database import SessionLocal  # noqa: E402
from app.models.profile import UserProfile  # noqa: E402
from app.models.user import User  # noqa: E402


def main() -> None:
    db = SessionLocal()
    try:
        rows = (
            db.query(User, UserProfile.onboarded_at)
            .outerjoin(UserProfile, UserProfile.user_id == User.id)
            .order_by(User.created_at)
            .all()
        )
        print(f"{len(rows)} user(s)\n")
        print(f"{'#':>3}  {'Email':<36} {'Username':<20} {'Joined':<11} {'Verified':<9} {'Sign-in':<16} Onboarded")
        for i, (user, onboarded_at) in enumerate(rows, 1):
            sign_in = "Google+password" if user.google_sub_hash and user.password_hash else (
                "Google" if user.google_sub_hash else "password"
            )
            print(
                f"{i:>3}  {user.email:<36} {user.username:<20} {user.created_at:%Y-%m-%d} "
                f"{'yes' if user.is_verified else 'no':<9} {sign_in:<16} {'yes' if onboarded_at else 'no'}"
            )
    finally:
        db.close()


if __name__ == "__main__":
    main()
