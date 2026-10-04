"""Generate visual comparison evidence and inventory pending references."""
from pathlib import Path
from PIL import Image, ImageChops, ImageEnhance, ImageStat
import json

captures = Path(__file__).parent / "captures"
metrics = {}

for reference in sorted(captures.glob("*-reference.png")):
    name = reference.name.removesuffix("-reference.png")
    application = captures / f"{name}-app.png"
    if name == "drawer":
        application = captures / "drawer-isolated-app.png"
    if not application.exists():
        continue

    ref = Image.open(reference).convert("RGB")
    app = Image.open(application).convert("RGB")
    if ref.size != app.size:
        raise ValueError(
            f"{name}: reference {ref.size} differs from app {app.size}"
        )

    side = Image.new("RGB", (ref.width * 2, ref.height), "white")
    side.paste(ref, (0, 0))
    side.paste(app, (ref.width, 0))
    side.save(captures / f"{name}-comparison.png")

    Image.blend(ref, app, 0.5).save(captures / f"{name}-overlay.png")

    difference = ImageChops.difference(ref, app)
    ImageEnhance.Brightness(difference).enhance(4).save(
        captures / f"{name}-diff.png"
    )
    metrics[name] = {
        "viewport": list(ref.size),
        "mean_absolute_rgb_difference": (
            sum(ImageStat.Stat(difference).mean) / 3
        ),
    }

continuation_names = [
    "saved",
    "following",
    "reviews-history",
    "category",
    "profile-address-add",
    "profile-address-edit",
    "checkout-address-add",
    "checkout-address-edit",
    "login",
    "login-invalid",
    "login-loading",
    "register",
    "register-validation",
]
responsive_widths = [360, 375, 390, 430, 440]
inventory = {}

for name in continuation_names:
    app_files = {}
    for width in responsive_widths:
        suffix = "" if width == 430 else f"-{width}"
        path = captures / f"{name}-app{suffix}.png"
        app_files[str(width)] = path.exists()

    reference = captures / f"{name}-reference.png"
    inventory[name] = {
        "application_captures": app_files,
        "reference_capture": reference.exists(),
        "comparison_ready": (
            app_files["430"] and reference.exists()
        ),
    }

(captures / "comparison-metrics.json").write_text(
    json.dumps(metrics, indent=2) + "\n"
)
(captures / "continuation-evidence.json").write_text(
    json.dumps(inventory, indent=2) + "\n"
)

ready = sum(1 for item in inventory.values() if item["comparison_ready"])
pending = len(inventory) - ready
print(
    f"Generated comparisons for {len(metrics)} screens; "
    f"continuation comparison-ready: {ready}, pending references: {pending}. "
    "Metrics are diagnostic, not a fidelity acceptance threshold."
)
