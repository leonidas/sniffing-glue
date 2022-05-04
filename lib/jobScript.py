#
# Generated with Glue studio in AWS Console
#
import sys
from awsglue.transforms import *
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from awsglue.context import GlueContext
from awsglue.job import Job

args = getResolvedOptions(sys.argv, ["JOB_NAME", "data_catalog_database", "data_catalog_table_name", "s3_path" ])
sc = SparkContext()
glueContext = GlueContext(sc)
spark = glueContext.spark_session
job = Job(glueContext)
job.init(args["JOB_NAME"], args)

# Script generated for node S3 bucket
S3bucket_node1 = glueContext.create_dynamic_frame.from_catalog(
    database= args["data_catalog_database"],
    table_name=args["data_catalog_table_name"],
    transformation_ctx="S3bucket_node1",
)

# Script generated for node ApplyMapping
ApplyMapping_node2 = ApplyMapping.apply(
    frame=S3bucket_node1,
    mappings=[
        # TODO change these depending on the data
        ("newvalue1", "long", "newvalue1", "long"),
        ("newvalue", "string", "newvalue", "string"),
        ("pk", "string", "pk", "string"),
    ],
    transformation_ctx="ApplyMapping_node2",
)

# Script generated for node S3 bucket
S3bucket_node3 = glueContext.write_dynamic_frame.from_options(
    frame=ApplyMapping_node2,
    connection_type="s3",
    format="glueparquet",
    connection_options={
        "path": args["s3_path"],
        "partitionKeys": [],
    },
    transformation_ctx="S3bucket_node3",
)

job.commit()
