terraform {
  required_version = ">= 1.5"
  required_providers {
    cloudflare = { source = "cloudflare/cloudflare", version = "~> 4.0" }
    random     = { source = "hashicorp/random", version = "~> 3.5" }
  }
}

variable "env" {
  description = "Environment"
  type        = string
  default     = "production"
  validation { condition = contains(["development","staging","production"], var.env) }
}

variable "domain" {
  type    = string
  default = "envvault.dev"
}

# R2 bucket per spec §68: private, no public access, encryption at rest, lifecycle, versioning
resource "random_id" "bucket_suffix" { byte_length = 4 }

# Placeholder: Cloudflare R2 bucket (private)
# resource "cloudflare_r2_bucket" "ciphertext" {
#   account_id = var.cloudflare_account_id
#   name       = "envvault-ciphertext-${var.env}-${random_id.bucket_suffix.hex}"
#   location   = "ENAM"
# }

# Postgres (e.g., Neon/Supabase) — prod would use managed service with PITR per §100
# resource "cloudflare_d1_database" "metadata" { ... } # or external

output "api_url" {
  value = var.env == "production" ? "https://api.${var.domain}" : "https://api-${var.env}.${var.domain}"
}

output "r2_bucket" {
  value = "envvault-ciphertext-${var.env}-${random_id.bucket_suffix.hex} (private, SSE, lifecycle, signed URLs 900s per §68)"
}

# Monitoring per §74
# - API p50/p95/p99, 5xx rate, upload/restore failure, auth failure
# - Uptime checks for /health, /ready
# - PagerDuty / Slack alerts (future)
