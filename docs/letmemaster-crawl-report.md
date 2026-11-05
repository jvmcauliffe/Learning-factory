# letmemaster.com crawl report (packet 26b)

Date: 5 November 2026 (fetch started 14:14:43 UTC, ended 14:16:45 UTC, 122 seconds).

Tools: `tools/fetch_letmemaster.py --max-pages 60`, then `tools/parse_letmemaster.py`, both from learning-factory PR 51. One crawl run; no retry; no change to the tools.

Permission: `docs/permissions/letmemaster.md` (owner reply of 5 November 2026) and John's separate go-ahead of the same day. Everything fetched is a candidate and unverified.

## Counts

| Item | Value |
|---|---|
| Page cap | 60 |
| Sitemap URLs listed | 197 |
| Fetched (status 200) | 60 |
| Resumed (already saved) | 0 |
| Robots-skipped | 0 |
| Host-skipped | 0 |
| Failed | 0 |
| Requests made | 62 = 1 robots.txt + 1 sitemap + 60 pages (inferred: the tool does not log requests; 122 s elapsed at a 2 s minimum gap allows at most 62) |
| Saved pages matching their sha256 | 60 of 60 |
| Two parse runs | byte-identical |
| LETMEMASTER_COOKIE set | No. Public pages only. |
| Parsed files | 60 (0 empty) |
| Headings / paragraphs / lists / tables | 516 / 910 / 586 / 34 |

Failed URLs: none.

## What the first 60 sitemap URLs cover

| Exam path | Pages |
|---|---|
| `/aws/mla-c02` | 38 |
| `/aws/saa-c03` | 19 |
| `/other` | 3 |

The tool takes the first 60 URLs in sitemap order, so the sample is mixed: 38 MLA-C02 pages (a different exam), 19 SAA-C03 pages and 3 pages outside `/aws/<exam>`. The sitemap lists 197 URLs, so most pages are not yet fetched. Reaching the rest of SAA-C03 cleanly needs a way to choose URLs (for example a path prefix option on the fetcher). That is a tool change and was out of scope here, so it is left for a separate packet.

Every page repeats the heading "Add LetMeMaster to your Home Screen" (site chrome, not study content). The parser keeps it verbatim, as designed; packet 27 should drop it when mapping.

## Pages (first headings only, no page text)

| Page | Headings |
|---|---|
| `/` | Prepare for your certification, a few minutes at a time. / Exams / AWS Certified Machine Learning Engineer – Associate |
| `/aws/mla-c02` | AWS Certified Machine Learning Engineer – Associate / Send feedback / Exam domains |
| `/aws/mla-c02/analytics` | Analytics |
| `/aws/mla-c02/analytics/amazon-managed-service-for-apache-flink` | Amazon Managed Service for Apache Flink / What it is / Concepts and features |
| `/aws/mla-c02/analytics/aws-glue-data-quality` | AWS Glue Data Quality / What it is / Two places to run it |
| `/aws/mla-c02/analytics/aws-glue-databrew` | AWS Glue DataBrew / What it is / Concepts and features |
| `/aws/mla-c02/application-integration` | Application Integration |
| `/aws/mla-c02/application-integration/amazon-mwaa` | Amazon MWAA (Managed Workflows for Apache Airflow) / What it is / Concepts and features |
| `/aws/mla-c02/compute` | Compute |
| `/aws/mla-c02/containers` | Containers |
| `/aws/mla-c02/cost-management` | Cloud Financial Management |
| `/aws/mla-c02/cost-management/aws-billing-and-cost-management` | AWS Billing and Cost Management / What it is / Concepts and features |
| `/aws/mla-c02/database` | Database |
| `/aws/mla-c02/developer-tools` | Developer Tools |
| `/aws/mla-c02/developer-tools/aws-cdk` | AWS CDK / What it is / Concepts and features |
| `/aws/mla-c02/developer-tools/aws-codeartifact` | AWS CodeArtifact / What it is / Concepts and features |
| `/aws/mla-c02/developer-tools/aws-codebuild` | AWS CodeBuild / What it is / Concepts and features |
| `/aws/mla-c02/developer-tools/aws-codecommit` | AWS CodeCommit / What it is / Concepts and features |
| `/aws/mla-c02/developer-tools/aws-codeconnections` | AWS CodeConnections / What it is / Concepts and features |
| `/aws/mla-c02/developer-tools/aws-codedeploy` | AWS CodeDeploy / What it is / Concepts and features |
| `/aws/mla-c02/developer-tools/aws-codepipeline` | AWS CodePipeline / What it is / Concepts and features |
| `/aws/mla-c02/machine-learning` | Machine Learning and Artificial Intelligence |
| `/aws/mla-c02/machine-learning/amazon-bedrock` | Amazon Bedrock / What it is / Choosing and calling a model |
| `/aws/mla-c02/machine-learning/amazon-bedrock-agentcore` | Amazon Bedrock AgentCore / What it is / The services |
| `/aws/mla-c02/machine-learning/amazon-codeguru` | Amazon CodeGuru / What it is / Concepts and features |
| `/aws/mla-c02/machine-learning/amazon-comprehend-medical` | Amazon Comprehend Medical / What it is / Concepts and features |
| `/aws/mla-c02/machine-learning/amazon-devops-guru` | Amazon DevOps Guru / What it is / Concepts and features |
| `/aws/mla-c02/machine-learning/amazon-personalize` | Amazon Personalize / What it is / Concepts and features |
| `/aws/mla-c02/machine-learning/aws-healthlake` | AWS HealthLake / What it is / Concepts and features |
| `/aws/mla-c02/machine-learning/sagemaker-ai-data-preparation` | SageMaker AI: preparing data and features / What it is / Data Wrangler in SageMaker Canvas |
| `/aws/mla-c02/machine-learning/sagemaker-ai-deployment-and-mlops` | SageMaker AI: deployment, MLOps, and monitoring / What it is / Choosing an inference option |
| `/aws/mla-c02/machine-learning/sagemaker-ai-training-and-tuning` | SageMaker AI: training and tuning models / What it is / Three ways to bring the algorithm |
| `/aws/mla-c02/management-and-governance` | Management and Governance |
| `/aws/mla-c02/media-services` | Media |
| `/aws/mla-c02/migration-and-transfer` | Migration and Transfer |
| `/aws/mla-c02/networking-and-content-delivery` | Networking and Content Delivery |
| `/aws/mla-c02/practice` | Practice / Sample quiz / Random quiz |
| `/aws/mla-c02/security-identity-and-compliance` | Security, Identity, and Compliance |
| `/aws/mla-c02/storage` | Storage |
| `/aws/saa-c03` | AWS Certified Solutions Architect – Associate / Exam domains / Exam format |
| `/aws/saa-c03/analytics` | Analytics |
| `/aws/saa-c03/analytics/analytics-services-overview` | Analytics services: choosing the right one / The services at a glance / How they fit together |
| `/aws/saa-c03/application-integration` | Application Integration |
| `/aws/saa-c03/compute` | Compute |
| `/aws/saa-c03/containers` | Containers |
| `/aws/saa-c03/cost-management` | AWS Cost Management |
| `/aws/saa-c03/database` | Database |
| `/aws/saa-c03/developer-tools` | Developer Tools |
| `/aws/saa-c03/front-end-web-and-mobile` | Front-End Web and Mobile |
| `/aws/saa-c03/machine-learning` | Machine Learning |
| `/aws/saa-c03/management-and-governance` | Management and Governance |
| `/aws/saa-c03/media-services` | Media Services |
| `/aws/saa-c03/migration-and-transfer` | Migration and Transfer |
| `/aws/saa-c03/networking-and-content-delivery` | Networking and Content Delivery |
| `/aws/saa-c03/practice` | Practice / Sample quiz / Random quiz |
| `/aws/saa-c03/security-identity-and-compliance` | Security, Identity, and Compliance |
| `/aws/saa-c03/serverless` | Serverless |
| `/aws/saa-c03/storage` | Storage |
| `/exams` | Exams / AWS Certified Machine Learning Engineer – Associate / AWS Certified Solutions Architect – Associate |
| `/tutorials` | Tutorials / Amazon Web Services |
