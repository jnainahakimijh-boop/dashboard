ALTER TABLE "ai_settings" ADD COLUMN "monthly_token_budget" integer;--> statement-breakpoint
ALTER TABLE "ai_settings" ADD COLUMN "allowed_features" jsonb DEFAULT '["executive_summary"]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_settings" ADD COLUMN "require_human_review" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "social_accounts" ADD COLUMN "metrics" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "websites" ADD COLUMN "settings" jsonb DEFAULT '{}'::jsonb NOT NULL;