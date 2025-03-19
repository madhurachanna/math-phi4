from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routers import users, chats

app = FastAPI()
# Enable CORS middleware
app.add_middleware(
    CORSMiddleware,
    # allow_origins=["*"],  # Allow all origins (you can specify allowed origins here)
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
)

Base.metadata.create_all(bind=engine)  # Creates Tables

app.include_router(users.router)
app.include_router(chats.router)
