from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.api.routes import router
from app.config import settings
from app.database import Base, SessionLocal, engine
from app.models import Workflow


def seed_demo_workflow() -> None:
    with SessionLocal() as database:
        exists = database.scalar(select(Workflow.id).limit(1))
        if exists:
            return

        database.add(
            Workflow(
                name="Checkout → CRM",
                source_type="webhook",
                target_name="HubSpot",
                input_format="json",
                field_mapping={
                    "order.id": "external_id",
                    "customer.email": "contact.email",
                    "total": "amount",
                },
                required_fields=["order.id", "customer.email"],
                max_retries=3,
            )
        )
        database.commit()


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    seed_demo_workflow()
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="API para receber, transformar e monitorar eventos de integração.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["health"])
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "aresta-api", "environment": settings.environment}


app.include_router(router, tags=["aresta"])
