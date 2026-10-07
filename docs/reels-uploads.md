# Seller Reel uploads

Sellers open `/seller/reels` from the existing seller dashboard, select an MP4, MOV or WebM video (maximum 50 MiB), add a caption and optionally link one of their active products. Publishing uses the existing `POST /reels` endpoint and redirects through a link to the published Reel.

Configure the API with `REEL_MEDIA_DIRECTORY` (a persistent directory outside the source checkout) and `REEL_MEDIA_BASE_URL` (the public HTTPS API origin). Without both values, uploads return an actionable 503. No database migrations or extra auth system are required.

`POST /seller/reels/media` accepts a raw video body and uses the existing bearer-token authentication. Seller verification happens before body parsing. Uploads check file signatures, permit at most five attempts per seller per minute and two concurrent uploads, and cap storage at 5 GiB. Abandoned uploads older than 24 hours are removed during subsequent uploads; files referenced by existing Reels are retained.

The reverse proxy must permit 50 MiB bodies and stream upload requests to the API. Public video playback is available only for published Reels via `/reels/media/:name` with HTTP byte-range support. Back up the persistent media directory alongside the PostgreSQL database. Current uploads preserve the original encoding; this release does not transcode video.
