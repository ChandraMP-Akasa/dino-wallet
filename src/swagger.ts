// src/swagger.ts
import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Application, Request, Response } from "express";

const swaggerDefinition = {
  openapi: "3.0.3",
  info: {
    title: "My API", // change
    version: "1.0.0",
    description: "API docs for my Express + TypeScript app",
  },
  servers: [
    {
      url: "http://localhost:8000/api", // change to your base URL
      description: "Local server"   ,
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
};

const options: swaggerJSDoc.Options = {
  swaggerDefinition,
  // Paths to files containing OpenAPI definitions in JSDoc comments.
  // Adjust glob pattern to match your src location / routes / controllers
  apis: ["./src/routes/**/*.ts", "./src/controllers/**/*.ts", "./src/models/**/*.ts"],
};

export const swaggerSpec = swaggerJSDoc(options);

export function mountSwagger(app: Application, path = "/api/docs") {
  // raw json
  app.get("/api/docs.json", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });

  // ui
  app.use(path, swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));
}
