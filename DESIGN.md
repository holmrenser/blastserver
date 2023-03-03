# Features

## Must

- Run BLAST jobs of various flavors (blastp, blastn, etc.) against all relevant databases
- Use NCBI taxonomy (could simply be linking to NCBI)
- Use Diamond instead of NCBI BLAST

## Should

- Load balancing to allow (many) simultaneous jobs
- Taxonomy distribution of hits
- Diamond formatted database for using database

## Could

- Email notification when job finishes
- Integraded taxonomy browsing
- Filtering of blast results

## Will not

# Similar work

- Genenotebook has some BLAST functionality, but only for custom DBs. BLAST output parsing code can be reused. No taxonomy. (https://genenotebook.github.io/)
- React-bio-viz has some components for visualization. BLAST visualization could be implemented here. (https://github.com/genenotebook/react-bio-viz)
- SequenceServer only handles custom DBs, could use nr and nt. No taxonomy. (https://sequenceserver.com/)

# Implementation

## Frontend

- React / Typescript
- ReactRouter for handling browser routing
- Similar user interface to NCBI

## Backend

- Node w/ express API
- BullMQ for redis jobqueue (https://docs.bullmq.io/guide/connections)
- BLAST/diamond
- NCBI databases

## Deployment / scaling

- Docker compose with nginx load balancer (https://pspdfkit.com/blog/2018/how-to-use-docker-compose-to-run-multiple-instances-of-a-service-in-development/)
- Multiple worker instances
