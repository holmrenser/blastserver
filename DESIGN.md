# Features

## Must

- Run BLAST jobs of various flavors (blastp, blastn, etc.) against all relevant databases
- Use NCBI taxonomy (could simply be linking to NCBI)

## Should

- Load balancing to allow (many) simultaneous jobs

## Could

- Email notification when job finishes
- Integraded taxonomy browsing

## Will not

# Implementation

## Frontend

- React / Typescript
- ReactRouter for handling browser routing
- Similar user interface to NCBI

## Backend

- Node w/ express API
- BullMQ for redis jobqueue (https://docs.bullmq.io/guide/connections)
- BLAST (obviously)
- NCBI databases

## Deployment / scaling

- Docker compose with nginx load balancer (https://pspdfkit.com/blog/2018/how-to-use-docker-compose-to-run-multiple-instances-of-a-service-in-development/)
- Multiple worker instances
