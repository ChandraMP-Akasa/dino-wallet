############################################
# 1. Builder Stage
############################################
FROM node:20-alpine AS builder

# Create app dir
WORKDIR /app

# Install build dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy rest of the source code
COPY . .

# Generate TSOA routes + spec
RUN npm run tsoa:gen

# Build TypeScript
RUN npm run build


############################################
# 2. Production Stage
############################################
FROM node:20-alpine AS runner

WORKDIR /app

# Install only production deps
COPY package.json package-lock.json ./
RUN npm install --omit=dev

# Copy build output from builder
COPY --from=builder /app/dist ./dist

# If your TSOA outputs swagger.json/openapi.json at root of dist
COPY --from=builder /app/dist/swagger.json ./dist/swagger.json

# Copy any required runtime assets (if any)
# COPY --from=builder /app/src/auth/keys ./keys  # (only if needed; recommended NOT to bake keys in image)

# Set environment
ENV NODE_ENV=production
ENV PORT=8000

# Expose port
EXPOSE 8000

# Start the server
CMD ["node", "dist/index.js"]
