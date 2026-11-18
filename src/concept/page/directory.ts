import type { Directory } from "./resolve";

// Which own domains the server knows. The demo keeps each business's state in
// its owner's browser, so the server only knows this fixture; a real build
// reads it from the database.

export const DEMO_DIRECTORY: Directory = {
  domains: { "boka.salong-eko.example": "salong-eko" },
};
