from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.database import Base, engine
from app.routers.users import router as users_router
from app.routers.chats import session_router
from app.ml_model import load_model, close_model


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manages the ML model's lifecycle."""
    print("Application startup: Loading ML model...")
    load_model()
    yield
    print("Application shutdown: Releasing ML model resources...")
    close_model()


app = FastAPI(
    title="AI Tutorial App Backend",
    description="Backend API for the AI Tutorial App with ML Model & Sessions",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

print("Creating database tables if they don't exist...")
Base.metadata.create_all(bind=engine)
print("Database tables checked/created.")

print("Including API routers...")
app.include_router(users_router)
app.include_router(session_router)
print("Routers included.")


@app.get("/")
def read_root():
    """Provides a simple welcome message for the root path."""
    return {"message": "Welcome to the AI Tutorial App Backend!"}


# To run: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
