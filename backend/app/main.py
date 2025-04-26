from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager  # Import asynccontextmanager

from app.database import Base, engine
from app.routers import users, chats
from app.ml_model import (
    load_model,
    close_model,
)  # Import model loading/closing functions


# --- Lifespan Management for ML Model ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manages the ML model's lifecycle."""
    # Startup: Load the ML model
    print("Application startup: Loading ML model...")
    load_model()  # Call the function to load the model
    yield
    # Shutdown: Clean up resources
    print("Application shutdown: Releasing ML model resources...")
    close_model()  # Call the function to release model resources


# --- FastAPI App Initialization ---
app = FastAPI(
    title="AI Tutorial App Backend",
    description="Backend API for the AI Tutorial App with ML Model",
    version="0.1.0",
    lifespan=lifespan,  # Register the lifespan context manager
)

# --- CORS Middleware ---
# Enable CORS middleware (adjust origins as needed)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Allow your React frontend origin
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods (GET, POST, etc.)
    allow_headers=["*"],  # Allow all headers
)

# --- Database Initialization ---
# Creates database tables defined in models.py if they don't exist
print("Creating database tables if they don't exist...")
Base.metadata.create_all(bind=engine)
print("Database tables checked/created.")

# --- Include Routers ---
# Mount the API endpoints defined in the routers
print("Including API routers...")
app.include_router(users.router)
app.include_router(chats.router)
print("Routers included.")


# --- Root Endpoint (Optional) ---
@app.get("/")
def read_root():
    """Provides a simple welcome message for the root path."""
    return {"message": "Welcome to the AI Tutorial App Backend!"}


# To run the app (from the 'backend' directory):
# uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
