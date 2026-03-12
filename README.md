# Cloudflare Edge Image Processing with Workers AI

This project implements an edge-based image processing system using Cloudflare's serverless platform. Images are stored in R2 object storage and served through a Cloudflare Worker. If an image does not already have a description, Workers AI automatically generates accessibility alt-text which is stored in a D1 database.

The system demonstrates how Cloudflare services can be combined to build scalable AI-powered media pipelines at the edge.

---

## Architecture Overview

The system integrates several Cloudflare services:

- **Cloudflare Workers** – Edge gateway that processes requests
- **R2 Object Storage** – Stores image assets
- **Workers AI Vision Models** – Generates alt-text descriptions
- **D1 Database** – Stores image metadata and descriptions
- **Cloudflare Cache API** – Improves performance by caching responses

When a user requests an image:

1. The Worker retrieves the image from R2.
2. The Worker checks D1 for an existing alt-text description.
3. If no description exists, Workers AI generates one.
4. The description is stored in D1.
5. The image is returned with a custom `X-Alt-Text` HTTP header.

---

## Features

- Edge-based image delivery via Cloudflare Workers
- AI-generated alt-text descriptions for accessibility
- Persistent metadata storage using D1
- Dynamic image ingestion from external URLs
- Global edge caching for performance optimization
- Administrative audit endpoint for metadata visibility

---

## API Endpoints

### List Images

GET /list-images

Returns a list of images stored in the R2 bucket.

---

### Retrieve Image

GET /<image-name>

Example:

http://localhost:8787/photo-1500530855697-b586d89ba3ee.jpg

Returns the image with a custom header:

X-Alt-Text: <generated description>

---

### Metadata Audit

GET /audit

Returns a JSON list of processed images and their alt-text descriptions stored in D1.

---

### Dynamic Image Ingestion

POST /ingest

Example request:

curl -X POST http://localhost:8787/ingest
-H "Content-Type: application/json"
-H "x-ingest-token: YOUR_SECRET"
-d '{"imageUrl":"https://example.com/image.jpg"}

This endpoint downloads the image, stores it in R2, and triggers background AI enrichment.

---

## Setup Instructions

### 1. Install Dependencies

npm install

---

### 2. Start Local Development

npx wrangler dev

The Worker will run locally at:

http://localhost:8787/

---

### 3. Configure Cloudflare Resources

The project requires:

- R2 bucket for image storage
- D1 database for metadata
- Workers AI binding
- Secret token for ingestion

These resources are configured through `wrangler.jsonc`.

---

## Example Response

Example HTTP response headers when requesting an image:

HTTP/1.1 200 OK
Content-Type: image/jpeg
X-Alt-Text: A road with a yellow line going through a mountain range

---

## Repository Structure

cloudflare-image-worker/
│
├── src/
│ └── index.js
│
├── wrangler.jsonc
├── package.json
└── README.md


---

## Author
Ishar Sehgal
Cloudflare Workers AI Assignment Implementation