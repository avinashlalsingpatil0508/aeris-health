# routes_users.py
# Handles everything about users: register, login, view, update, delete.

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import User
from schemas import UserRegister, UserLogin, UserOut
from security import hash_password, check_password
from exceptions import DuplicateError, BadRequestError, NotFoundError
from helpers import success_response

router = APIRouter(prefix="/api/users", tags=["Users"])


@router.post("/register", status_code=201)
def register_user(data: UserRegister, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == data.email).first()
    if existing_user:
        raise DuplicateError(f"Email already registered: {data.email}")

    new_user = User(
        name=data.name.strip(),
        email=str(data.email).lower().strip(),
        password=hash_password(data.password),
        age=data.age,
        gender=data.gender,
        health_condition=(data.healthCondition or "NORMAL").upper(),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return success_response(UserOut.from_user(new_user), "User registered successfully")


@router.post("/login")
def login_user(data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == str(data.email).lower().strip()).first()

    if not user or not check_password(data.password, user.password):
        raise BadRequestError("Invalid email or password")

    return success_response(UserOut.from_user(user), "Login successful")


@router.get("")
def get_all_users(db: Session = Depends(get_db)):
    users = db.query(User).all()
    result = [UserOut.from_user(u) for u in users]
    return success_response(result, f"Found {len(result)} users")


@router.get("/{user_id}")
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise NotFoundError(f"User not found with id: {user_id}")
    return success_response(UserOut.from_user(user))


@router.put("/{user_id}")
def update_user(user_id: int, data: UserRegister, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise NotFoundError(f"User not found with id: {user_id}")

    new_email = str(data.email).lower().strip()
    if new_email != user.email:
        taken = db.query(User).filter(User.email == new_email).first()
        if taken:
            raise DuplicateError(f"Email already in use: {data.email}")

    user.name = data.name.strip()
    user.email = new_email
    user.age = data.age
    user.gender = data.gender
    user.health_condition = (data.healthCondition or "NORMAL").upper()
    if data.password:
        user.password = hash_password(data.password)

    db.commit()
    db.refresh(user)
    return success_response(UserOut.from_user(user), "User updated successfully")


@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise NotFoundError(f"User not found with id: {user_id}")
    db.delete(user)
    db.commit()
    return success_response(None, "User deleted successfully")
