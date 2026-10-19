CREATE TABLE "ad_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"platform" text DEFAULT 'chatgpt_ads' NOT NULL,
	"name" text NOT NULL,
	"external_id" text,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"timezone" text DEFAULT 'Europe/Paris' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"connection_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ad_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ad_account_id" uuid NOT NULL,
	"key" text NOT NULL,
	"external_id" text,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"objective" text,
	"status" text NOT NULL,
	"monthly_budget" double precision,
	"start_date" date,
	"end_date" date,
	"utm_campaign" text,
	"business_unit" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ad_campaigns_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "ad_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"key" text NOT NULL,
	"external_id" text,
	"name" text NOT NULL,
	"status" text NOT NULL,
	"status_since" date,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ad_groups_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "ads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ad_group_id" uuid NOT NULL,
	"key" text NOT NULL,
	"external_id" text,
	"name" text NOT NULL,
	"headline" text,
	"landing_url" text,
	"site_key" text,
	"status" text DEFAULT 'active' NOT NULL,
	"review_status" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ads_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "ai_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid,
	"purpose" text NOT NULL,
	"provider" text NOT NULL,
	"model" text,
	"status" text NOT NULL,
	"input_hash" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"latency_ms" integer,
	"output" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_prompt_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"key" text NOT NULL,
	"version" integer NOT NULL,
	"body" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_settings" (
	"org_id" uuid PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"provider" text DEFAULT 'none' NOT NULL,
	"model" text,
	"base_url" text,
	"external_processing_approved" boolean DEFAULT false NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"max_output_tokens" integer DEFAULT 800 NOT NULL,
	"temperature" double precision DEFAULT 0.2 NOT NULL,
	"connection_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"rule_id" uuid,
	"fingerprint" text NOT NULL,
	"source" text NOT NULL,
	"severity" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"title" text NOT NULL,
	"title_fr" text,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurrences" integer DEFAULT 1 NOT NULL,
	"first_triggered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_triggered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"acknowledged_by" uuid,
	"acknowledged_at" timestamp with time zone,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "alert_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"metric_id" text NOT NULL,
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"condition" text NOT NULL,
	"threshold" double precision,
	"window_days" integer DEFAULT 7 NOT NULL,
	"compare" text DEFAULT 'previous' NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"cooldown_hours" integer DEFAULT 24 NOT NULL,
	"channels" jsonb DEFAULT '["in_app"]'::jsonb NOT NULL,
	"recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_evaluated_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"user_id" uuid,
	"user_email" text,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"outcome" text DEFAULT 'success' NOT NULL,
	"ip" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"key" text NOT NULL,
	"utm" text NOT NULL,
	"name_en" text NOT NULL,
	"name_fr" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"topic" text,
	"business_unit" text,
	"objective" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaigns_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "competitor_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competitor_id" uuid NOT NULL,
	"metric" text NOT NULL,
	"value" double precision NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"source" text NOT NULL,
	"source_url" text,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"domain" text NOT NULL,
	"topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competitors_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "content_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"source_key" text NOT NULL,
	"channel" text NOT NULL,
	"title" text NOT NULL,
	"url" text,
	"language" text,
	"published_at" date,
	"content_updated_at" date,
	"topic" text,
	"business_unit" text,
	"pillar" text,
	"objective" text,
	"audience" text,
	"campaign" text,
	"format" text,
	"owner" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "content_items_source_key_unique" UNIQUE("source_key")
);
--> statement-breakpoint
CREATE TABLE "content_tags" (
	"content_id" uuid NOT NULL,
	"tag" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_tags_content_id_tag_pk" PRIMARY KEY("content_id","tag")
);
--> statement-breakpoint
CREATE TABLE "dashboards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"layout" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dashboards_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "data_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'not_configured' NOT NULL,
	"mode" text DEFAULT 'demo' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"secret_ciphertext" text,
	"secret_updated_at" timestamp with time zone,
	"scope_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_sync_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_error" text,
	"data_from" date,
	"data_to" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fact_rows" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "fact_rows_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"dataset" text NOT NULL,
	"connection_id" uuid,
	"import_id" uuid,
	"day" date NOT NULL,
	"dims" jsonb NOT NULL,
	"measures" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"ref" text NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geo_measurements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"prompt_key" text NOT NULL,
	"prompt_version" integer NOT NULL,
	"provider" text NOT NULL,
	"measured_on" date NOT NULL,
	"status" text NOT NULL,
	"mentioned" boolean,
	"cited" boolean,
	"mention_rank" integer,
	"cited_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cited_domains" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"competitors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confidence" text,
	"model" text,
	"excerpt" text,
	"error" text,
	"origin" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geo_prompt_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prompt_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"text" text NOT NULL,
	"change_note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geo_prompts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"key" text NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"language" text NOT NULL,
	"topic" text NOT NULL,
	"intent" text NOT NULL,
	"market" text NOT NULL,
	"priority" text NOT NULL,
	"expected_pages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "geo_prompts_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"dataset" text NOT NULL,
	"file_name" text NOT NULL,
	"file_type" text NOT NULL,
	"status" text NOT NULL,
	"rows_total" integer DEFAULT 0 NOT NULL,
	"rows_accepted" integer DEFAULT 0 NOT NULL,
	"rows_rejected" integer DEFAULT 0 NOT NULL,
	"rejected" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"date_from" date,
	"date_to" date,
	"replace_existing" boolean DEFAULT true NOT NULL,
	"connection_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"last_error" text,
	"result" jsonb,
	"dedupe_key" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "keyword_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "keywords" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"group_id" uuid,
	"keyword" text NOT NULL,
	"site_key" text NOT NULL,
	"country" text,
	"language" text NOT NULL,
	"target_url" text,
	"brand" boolean DEFAULT false NOT NULL,
	"tracking_source" text DEFAULT 'gsc' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metric_definitions" (
	"metric_id" text PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"label_en" text,
	"label_fr" text,
	"definition_en" text,
	"definition_fr" text,
	"owner" text,
	"notes" text,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metric_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"metric_id" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"value" double precision NOT NULL,
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"owner" text,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"timezone" text DEFAULT 'Europe/Paris' NOT NULL,
	"default_language" text DEFAULT 'fr' NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"logo_data_url" text,
	"demo_mode" boolean DEFAULT true NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "recommendation_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recommendation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommendation_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recommendation_id" uuid NOT NULL,
	"user_id" uuid,
	"field" text NOT NULL,
	"from_value" text,
	"to_value" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"rule_key" text,
	"origin" text NOT NULL,
	"title" text NOT NULL,
	"title_fr" text,
	"summary" text NOT NULL,
	"summary_fr" text,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"kpis" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"channels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"priority" text NOT NULL,
	"impact" text NOT NULL,
	"effort" text,
	"action" text NOT NULL,
	"action_fr" text,
	"owner_id" uuid,
	"status" text DEFAULT 'new' NOT NULL,
	"due_date" date,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confidence" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status_changed_at" timestamp with time zone,
	CONSTRAINT "recommendations_fingerprint_unique" UNIQUE("fingerprint")
);
--> statement-breakpoint
CREATE TABLE "report_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"template_id" uuid,
	"schedule_id" uuid,
	"title" text NOT NULL,
	"status" text NOT NULL,
	"format" text NOT NULL,
	"file_name" text,
	"file_bytes" "bytea",
	"size_bytes" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"delivery_status" text DEFAULT 'not_requested' NOT NULL,
	"delivery_log" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"name" text NOT NULL,
	"frequency" jsonb NOT NULL,
	"format" text NOT NULL,
	"recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"next_run_at" timestamp with time zone,
	"last_run_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"config" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"route" text NOT NULL,
	"state" jsonb NOT NULL,
	"shared" boolean DEFAULT false NOT NULL,
	"is_preset" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"job_type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"frequency" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp with time zone,
	"next_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_crawl_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"crawl_id" uuid NOT NULL,
	"url" text NOT NULL,
	"status_code" integer,
	"content_type" text,
	"title" text,
	"meta_description" text,
	"h1_count" integer,
	"canonical" text,
	"robots_meta" text,
	"hreflang" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"word_count" integer,
	"images_missing_alt" integer,
	"internal_links" integer,
	"response_ms" integer,
	"depth" integer DEFAULT 0 NOT NULL,
	"redirected_to" text,
	"blocked_by_robots" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_crawl_scopes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"website_key" text NOT NULL,
	"name" text NOT NULL,
	"allowed_hosts" jsonb NOT NULL,
	"start_urls" jsonb NOT NULL,
	"include_patterns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"exclude_patterns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"max_pages" integer DEFAULT 200 NOT NULL,
	"max_depth" integer DEFAULT 4 NOT NULL,
	"delay_ms" integer DEFAULT 1500 NOT NULL,
	"authorized" boolean DEFAULT false NOT NULL,
	"authorized_by" uuid,
	"authorized_at" timestamp with time zone,
	"enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_crawls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope_id" uuid NOT NULL,
	"status" text NOT NULL,
	"source" text DEFAULT 'crawler' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"pages_crawled" integer DEFAULT 0 NOT NULL,
	"issues_found" integer DEFAULT 0 NOT NULL,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"triggered_by" uuid
);
--> statement-breakpoint
CREATE TABLE "seo_issue_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issue_id" uuid NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"from_value" text,
	"to_value" text,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"website_key" text NOT NULL,
	"rule" text NOT NULL,
	"severity" text NOT NULL,
	"url" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"owner_id" uuid,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"last_crawl_id" uuid
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip" text,
	"user_agent" text,
	"method" text DEFAULT 'password' NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "social_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"key" text NOT NULL,
	"platform" text NOT NULL,
	"name" text NOT NULL,
	"handle" text,
	"external_id" text,
	"language" text NOT NULL,
	"region" text,
	"business_unit" text,
	"status" text DEFAULT 'active' NOT NULL,
	"connection_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_accounts_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "sync_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"job_id" uuid,
	"kind" text DEFAULT 'sync' NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"rows_written" integer DEFAULT 0 NOT NULL,
	"error" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"level" text NOT NULL,
	"source" text NOT NULL,
	"message" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "taxonomy_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"key" text NOT NULL,
	"label_en" text NOT NULL,
	"label_fr" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"password_hash" text,
	"status" text DEFAULT 'active' NOT NULL,
	"language" text DEFAULT 'fr' NOT NULL,
	"scopes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"failed_logins" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "websites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"domain" text NOT NULL,
	"base_path" text DEFAULT '/' NOT NULL,
	"language" text NOT NULL,
	"business_unit" text,
	"ga4_property" text,
	"gsc_property" text,
	"drupal_enabled" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "websites_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_tpl_key_version_uq" ON "ai_prompt_templates" USING btree ("key","version");--> statement-breakpoint
CREATE INDEX "alert_events_fp_idx" ON "alert_events" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "content_kind_idx" ON "content_items" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "fact_dataset_day_idx" ON "fact_rows" USING btree ("dataset","day");--> statement-breakpoint
CREATE UNIQUE INDEX "favorites_user_ref_uq" ON "favorites" USING btree ("user_id","kind","ref");--> statement-breakpoint
CREATE INDEX "geo_meas_day_idx" ON "geo_measurements" USING btree ("measured_on");--> statement-breakpoint
CREATE UNIQUE INDEX "geo_prompt_version_uq" ON "geo_prompt_versions" USING btree ("prompt_id","version");--> statement-breakpoint
CREATE INDEX "jobs_status_run_idx" ON "jobs" USING btree ("status","run_at");--> statement-breakpoint
CREATE UNIQUE INDEX "keywords_site_kw_uq" ON "keywords" USING btree ("site_key","keyword");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "crawl_pages_crawl_idx" ON "seo_crawl_pages" USING btree ("crawl_id");--> statement-breakpoint
CREATE UNIQUE INDEX "seo_issue_rule_url_uq" ON "seo_issues" USING btree ("rule","url");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sync_conn_idx" ON "sync_executions" USING btree ("connection_id","started_at");--> statement-breakpoint
CREATE INDEX "system_events_created_idx" ON "system_events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "taxonomy_kind_key_uq" ON "taxonomy_terms" USING btree ("kind","key");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree (lower("email"));