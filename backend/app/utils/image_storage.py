import base64
import os
import uuid
from datetime import datetime
from PIL import Image
from io import BytesIO

BASE_DIR = "assets/images"


def ensure_dir(path: str):
    os.makedirs(path, exist_ok=True)


def save_image_from_base64(b64_data: str) -> str:
    """
    Save base64 image → png optimized file
    Returns public URL
    """

    date_folder = datetime.now().strftime("%Y/%m/%d")
    folder_path = os.path.join(BASE_DIR, date_folder)
    ensure_dir(folder_path)

    file_id = uuid.uuid4().hex
    file_path = os.path.join(folder_path, f"{file_id}.png")

    if "," in b64_data:
        b64_data = b64_data.split(",", 1)[1]
    image_bytes = base64.b64decode(b64_data)

    image = Image.open(BytesIO(image_bytes))
    if image.mode in ("RGBA", "P"):
        image = image.convert("RGBA")
    else:
        image = image.convert("RGB")
    image.save(file_path, "PNG", optimize=True)

    return f"/assets/images/{date_folder}/{file_id}.png"