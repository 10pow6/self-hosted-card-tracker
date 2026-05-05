"""Model-slot catalog. The active option for each slot is read from `config.py`;
the catalog of available options is hardcoded here for now (no runtime swap yet).
"""
from __future__ import annotations

from card_tracker.config import settings


def list_slots() -> list[dict]:
    detection = [
        {
            "id": "opencv-grid-v1",
            "name": "OpenCV grid detector",
            "description": "Bbox + per-cell saturation refinement. Local, no model weights required.",
            "version": "1.0",
            "status": "active",
            "local": True,
        },
        {
            "id": "vision-llm-local",
            "name": "Vision LLM (local)",
            "description": "Use a local multimodal model to detect card boundaries.",
            "version": None,
            "status": "coming-soon",
            "local": True,
        },
        {
            "id": "claude-vision",
            "name": "Claude Vision",
            "description": "Send page photos to Anthropic for high-accuracy detection. Requires API key.",
            "version": None,
            "status": "coming-soon",
            "local": False,
        },
    ]

    embeddings = [
        {
            "id": settings.embedder_name,
            "name": "DINOv2-small",
            "description": "21M params, 384-dim embeddings. CPU-tractable, fully offline.",
            "version": settings.embedder_version,
            "status": "active",
            "local": True,
        },
        {
            "id": "dinov2-base",
            "name": "DINOv2-base",
            "description": "86M params, 768-dim embeddings. More accurate, slower.",
            "version": None,
            "status": "available",
            "local": True,
        },
        {
            "id": "openclip-vit-l",
            "name": "OpenCLIP ViT-L/14",
            "description": "Strong general-purpose embeddings. Larger model.",
            "version": None,
            "status": "coming-soon",
            "local": True,
        },
        {
            "id": "voyage-multimodal",
            "name": "Voyage Multimodal",
            "description": "Hosted multimodal embeddings via Voyage AI.",
            "version": None,
            "status": "coming-soon",
            "local": False,
        },
    ]

    metadata = [
        {
            "id": "manual",
            "name": "Manual entry",
            "description": "Enter card metadata by hand. No external lookups.",
            "version": "1.0",
            "status": "active",
            "local": True,
        },
        {
            "id": "agent-orchestrated",
            "name": "Agent-orchestrated lookup",
            "description": (
                "Run a small agent that consults configured connections (MCP servers, REST APIs) "
                "to fill in card metadata."
            ),
            "version": None,
            "status": "coming-soon",
            "local": False,
        },
    ]

    connections = [
        {
            "id": "tcgplayer",
            "name": "TCGPlayer",
            "kind": "api",
            "description": "Public TCG marketplace data — set lists, pricing, images.",
            "status": "coming-soon",
        },
        {
            "id": "pokemontcg-mcp",
            "name": "pokemontcg.io (MCP)",
            "kind": "mcp",
            "description": "MCP server wrapping the pokemontcg.io card catalog.",
            "status": "coming-soon",
        },
        {
            "id": "sports-card-agent",
            "name": "Sports card lookup agent",
            "kind": "agent",
            "description": "Custom agent that searches Beckett / SportsCardsPro by image + OCR text.",
            "status": "coming-soon",
        },
    ]

    return [
        {
            "id": "detection",
            "title": "Page detection",
            "description": "How a binder-page photo is parsed into 9 individual card slots.",
            "active_option_id": "opencv-grid-v1",
            "options": detection,
        },
        {
            "id": "embeddings",
            "title": "Embeddings & similarity",
            "description": "Model used to embed card crops and find duplicates in CORE.",
            "active_option_id": settings.embedder_name,
            "options": embeddings,
        },
        {
            "id": "metadata",
            "title": "Metadata enrichment",
            "description": "How CORE rows learn names, sets, numbers, and other metadata.",
            "active_option_id": "manual",
            "options": metadata,
            "connections": connections,
        },
    ]
