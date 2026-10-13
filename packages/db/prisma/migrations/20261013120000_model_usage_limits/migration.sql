-- CreateTable
CREATE TABLE "model_usage_limits" (
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "windows" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "model_usage_limits_pkey" PRIMARY KEY ("userId","provider")
);

-- AddForeignKey
ALTER TABLE "model_usage_limits" ADD CONSTRAINT "model_usage_limits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
