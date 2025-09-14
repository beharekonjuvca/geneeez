from __future__ import annotations
from typing import Optional
from datetime import datetime, timezone
from sqlalchemy import String, Integer, DateTime, Boolean, ForeignKey, UniqueConstraint, BigInteger, Text, Column, Enum, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db import Base
from sqlalchemy.sql import func
import enum

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String)
    role: Mapped[str] = mapped_column(String, default="user")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String, unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (UniqueConstraint("token_hash", name="uq_refresh_token_hash"),)

class Dataset(Base):
    __tablename__ = "datasets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200), index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    storage_path: Mapped[str] = mapped_column(String(500)) 
    @property
    def file_path(self) -> str | None:
        return self.storage_path

    original_filename: Mapped[str] = mapped_column(String(255))
    mime_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    file_size_bytes: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)

    n_rows: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    n_cols: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    owner_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    owner: Mapped["User"] = relationship("User")

    is_public: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
class RunStatus(str, enum.Enum):
    queued = "queued"
    running = "running"
    succeeded = "succeeded"
    failed = "failed"
    canceled = "canceled"

class AnalysisRecipeTemplate(Base):
    __tablename__ = "analysis_recipe_templates"
    id = Column(BigInteger, primary_key=True)
    key = Column(String(64), unique=True, nullable=False)
    display_name = Column(String(128), nullable=False)
    description = Column(Text)
    nb_template_uri = Column(Text)
    params_schema = Column(JSON, nullable=False, default=dict)
    is_user_visible = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class AnalysisRun(Base):
    __tablename__ = "analysis_runs"
    id = Column(BigInteger, primary_key=True)
    dataset_id = Column(BigInteger, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    recipe_key = Column(String(64), nullable=False)
    params_json = Column(JSON, nullable=False)
    status = Column(Enum(RunStatus), nullable=False, default=RunStatus.queued)
    cache_key = Column(String(128))
    cache_hit = Column(Boolean, default=False)
    started_at = Column(DateTime(timezone=True))
    finished_at = Column(DateTime(timezone=True))
    artifacts_json = Column(JSON)
    error_message = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    dataset = relationship("Dataset")
    user = relationship("User")

class UserNotebook(Base):
    __tablename__ = "user_notebooks"
    id = Column(BigInteger, primary_key=True)
    dataset_id = Column(BigInteger, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), nullable=False)
    ipynb_json = Column(JSON, nullable=False)
    last_run_id = Column(BigInteger, ForeignKey("analysis_runs.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    dataset = relationship("Dataset")
    user = relationship("User")
