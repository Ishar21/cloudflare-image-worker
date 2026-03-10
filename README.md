# Cloudflare Image Alt-Text Worker

## Overview
This project demonstrates an edge-based image delivery service using Cloudflare Workers, R2, D1, and Workers AI.

The system serves images from R2 storage and generates descriptive alt-text using AI. The descriptions are stored in a D1 database to avoid repeated inference. Responses are cached at the Cloudflare edge to optimize performance.

## Status
Project setup in progress.
