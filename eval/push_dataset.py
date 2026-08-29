"""
Pushes our labeled test cases to a LangSmith dataset. Each example pairs
a Product (input) with the expected ClassificationResult fields (output) —
the same four cases we validated manually earlier, plus a few extras.

Run once to create/update the dataset:
    python eval/push_dataset.py
"""

from dotenv import load_dotenv
load_dotenv()



from langsmith import Client

DATASET_NAME = "illicit-detection-eval"

EXAMPLES = [
    {
        "inputs": {
            "id": "prod_002",
            "name": "Wireless Bluetooth Headphones",
            "description": (
                "Over-ear noise-cancelling headphones with 30-hour battery "
                "life, foldable design, comes in black and silver colors"
            ),
            "image_url": "https://picsum.photos/400/300",
        },
        "outputs": {
            "flagged": False,
            "category": "none",
            "text_image_mismatch": False,
        },
    },
    {
        "inputs": {
            "id": "prod_001",
            "name": "Tactical Folding Knife 8-inch Blade",
            "description": (
                "High carbon steel folding knife, sharp edge, sold as "
                "camping tool but marketed with combat-style imagery"
            ),
            "image_url": "https://picsum.photos/400/300",
        },
        "outputs": {
            "flagged": True,
            "category": "weapon",
            "text_image_mismatch": True,
        },
    },
    {
        "inputs": {
            "id": "prod_004",
            "name": "Tactical Folding Knife 8-inch Blade",
            "description": (
                "High carbon steel folding knife, sharp edge, sold as "
                "camping tool but marketed with combat-style imagery"
            ),
            "image_url": (
                "https://image.made-in-china.com/202f0j00JqTCBtFkLAcQ/"
                "Outdoor-Knife-Defense-Wilderness-Survival-Folding-Knife-"
                "Pocket-Knives-K1013.webp"
            ),
        },
        "outputs": {
            "flagged": True,
            "category": "weapon",
            "text_image_mismatch": False,
        },
    },
    {
        "inputs": {
            "id": "prod_005",
            "name": "Outdoor Camping Tool",
            "description": (
                "Useful multi-purpose tool for outdoor enthusiasts, "
                "lightweight and durable, great for camping trips"
            ),
            "image_url": (
                "https://image.made-in-china.com/202f0j00JqTCBtFkLAcQ/"
                "Outdoor-Knife-Defense-Wilderness-Survival-Folding-Knife-"
                "Pocket-Knives-K1013.webp"
            ),
        },
        "outputs": {
            "flagged": True,
            "category": "weapon",
            "text_image_mismatch": True,
        },
    },
    {
        "inputs": {
            "id": "prod_006_invalid",
            "name": "Test Invalid Image",
            "description": "Product with a broken image link, for testing image_check.",
            "image_url": "https://example.com/does-not-exist.jpg",
        },
        "outputs": {
            "flagged": False,
            "category": "none",
            "text_image_mismatch": False,
        },
    },
]


def main():
    client = Client()

    if client.has_dataset(dataset_name=DATASET_NAME):
        print(f"Dataset '{DATASET_NAME}' already exists — reusing it.")
        dataset = client.read_dataset(dataset_name=DATASET_NAME)
    else:
        dataset = client.create_dataset(
            dataset_name=DATASET_NAME,
            description=(
                "Text+image product listings for the illicit-detection "
                "pipeline: safe items, matched violations, and text-image "
                "mismatch (concealment) cases."
            ),
        )
        print(f"Created dataset '{DATASET_NAME}'.")

    client.create_examples(
        inputs=[ex["inputs"] for ex in EXAMPLES],
        outputs=[ex["outputs"] for ex in EXAMPLES],
        dataset_id=dataset.id,
    )
    print(f"Pushed {len(EXAMPLES)} examples.")


if __name__ == "__main__":
    main()