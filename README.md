# Sniffing Glue

## What is this mess?

One developer's experiment on trying to analyze data in DynamoDB with AWS Athena.
DynamoDB doesn't provide much tools for ad hoc or analytics kind of queries, but Athena allows querying data in S3 with SQL and AWS Glue allows us to transform the dynamo data to an Athena compliant format.
This project is an attempt to get the data in DynamoDB to S3 in queryable format, using CDK and some aws-sdk scripting, with minimal AWS Console usage. I'm not sure if this is the most cost effective or otherwise optimal way to do it, but at least I got it to work.

## How does it work?

You can find all the components of the app in `lib/infra-stack.ts` + `lib/glue-job-stack.ts`. In addition to the CDK infra, there's some scripts in `./scripts.ts`.
Simply put the app just converts dynamo data to parquet and detects its schema so that Athena can query it.

1. The initial data lies in a DynamoDB table
1. A glue crawler crawls through the table, detecting its schema
1. Based on the schema an ETL script is created for converting the data to parquet
1. Using the ETL script a glue job is created and then executed
1. The ETL job puts the data to an S3 bucket in parquet format
1. Now a separate glue crawler is used to detect the schema of the parquet data
1. Now the data can be queried with Athena

## How to deploy?

Can't be deployed nicely with just one step because the Glue crawler needs to be run before we'll deploy the ETL job.
When InfraStack deploy completes it should print out all the needed parameters for the rest of the steps.

```bash
# deploys all the needed resources except the ETL job
cdk deploy

# Your dynamotable is now created, put some stuff in there
# This example uses a list of degree programmes of Tampere University
npm run loadData --  --tableName=[InfraStack.DynamoTableName]

# Run dynamocrawler, needs the CrawlerName outputted by the first step, this takes some time to complete
npm run runCrawler -- --crawlerName=[InfraStack.DynamoCrawlerName]

# Get the name of the data catalog table the crawler created
npm run getTableNames -- --glueDatabaseName=[InfraStack.GlueDatabaseName]

# create the script for the ETL job
npm run createScript -- --glueDatabaseName=[InfraStack.GlueDatabaseName] --s3TargetBucketName=[InfraStack.S3TargetBucketName]

# Now that you have the script (in lib/glueETLScript.py) you can create the glue ETL job with CDK
# Needs the app argument because the default app is the infra app
# bootsrap first because it uses assets
npm run cdk -- --app "npx ts-node --prefer-ts-exts bin/glue-job.ts" \
 -c scriptFile="glueETLScript.py" \
 -c glueTableName=[from the getTableNames step earlier] \
 -c glueDatabaseName=[GlueDatabaseName] \
 -c targetBucketName=[S3TargetBucketName] \
 -c roleArn=[RoleArn] \
 bootstrap
npm run cdk -- --app "npx ts-node --prefer-ts-exts bin/glue-job.ts" \
 -c scriptFile="glueETLScript.py" \
 -c glueTableName=[from the getTableNames step earlier] \
 -c glueDatabaseName=[GlueDatabaseName] \
 -c targetBucketName=[S3TargetBucketName] \
 -c roleArn=[RoleArn] \
 deploy

# The job is created, now run it. This takes many minutes, in my experiments aprox. 10 min for it to start and run
npm run -- runETLjob --jobName=[GlueJobStack.ETLJobName]

# When that's done, the parquet files should be in s3, now run parquet crawler
npm run runCrawler -- --crawlerName=[InfraStack.ParquetCrawlerName]

# Done! Nice!
```

After all of this, now you should find your data in AWS Athena console and type in queries in SQL and study your data way more easily.
For an example query this should get all tech degrees and order them by the credits needed.
Note that depending on your configuration the names of the db and the table may vary.

    select * from "sniffing-glue-db"."dynamoathenaparquetaws_glue_cirit_sniffing_glue_target"
    WHERE groupid like '%tut-dp-g-%'
    ORDER BY mincredits

Note that neither of the attributes used is indexed in dynamo, so making a query like this in Dynamo would be difficult.

Note that you need to run the ETL job manually whenever you want to get the latest version of your dynamo to Athena.
It can also be run on a schedule.

## Things to note

- I have this far only tested this with one dimensional data (ie. no objects or arrays in dynamo). I'm not sure if it'll work so well with multi-dimensional data, probably needs some data transfomations in the ETL job.
- I'm not a data scientist and stuff like spark are very new to me, some solutions might be nonconventional
- The createScript API seems very finicky, I'm looking into skipping that step and just writing the script myself.
- The example data set is very small, making it hard to estimate the costs and performance of this with huge tables. As always, be wary and monitor your billing.
