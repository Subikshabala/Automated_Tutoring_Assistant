-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MaterialChunk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "materialId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL,
    "embedding" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "MaterialChunk_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MaterialChunk" ("content", "id", "materialId", "order", "tokenCount") SELECT "content", "id", "materialId", "order", "tokenCount" FROM "MaterialChunk";
DROP TABLE "MaterialChunk";
ALTER TABLE "new_MaterialChunk" RENAME TO "MaterialChunk";
CREATE INDEX "MaterialChunk_materialId_idx" ON "MaterialChunk"("materialId");
CREATE UNIQUE INDEX "MaterialChunk_materialId_order_key" ON "MaterialChunk"("materialId", "order");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
