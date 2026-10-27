-- CreateTable
CREATE TABLE "photos" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "photos_user_id_idx" ON "photos"("user_id");

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Las casillas guardan el identificador de su foto (`photoId`) en lugar de la
-- foto incrustada (`imagePath`). Las fotos incrustadas que hubiera se quitan:
-- solo había datos de desarrollo, sin desplegar.
UPDATE "boards"
SET "cells" = (
    SELECT jsonb_agg((cell - 'imagePath') || jsonb_build_object('photoId', NULL) ORDER BY position)
    FROM jsonb_array_elements("cells") WITH ORDINALITY AS item(cell, position)
)
WHERE jsonb_typeof("cells") = 'array' AND jsonb_array_length("cells") > 0;
