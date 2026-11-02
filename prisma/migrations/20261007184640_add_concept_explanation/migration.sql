-- CreateTable
CREATE TABLE "ConceptExplanation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conceptId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "simpleExplanation" TEXT NOT NULL,
    "whyItMatters" TEXT NOT NULL,
    "example" TEXT NOT NULL,
    "keyPoints" TEXT NOT NULL DEFAULT '[]',
    "checkQuestion" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConceptExplanation_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ConceptExplanation_conceptId_key" ON "ConceptExplanation"("conceptId");
