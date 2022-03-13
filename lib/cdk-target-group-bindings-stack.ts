import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';

import { AwsLoadBalancerControllerIamPolicy } from "./iam-policy";

export class CdkTargetGroupBindingsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // provisiong a cluster
    const cluster = new eks.Cluster(this, 'hello-eks', {
      version: eks.KubernetesVersion.V1_21,
    });

    // install aws load balancer controller
    const serviceAccount = cluster.addServiceAccount('awsLoadBalancerControllerServiceAccount', {
      name: 'aws-load-balancer-controller',
      namespace: 'kube-system',
    });

    AwsLoadBalancerControllerIamPolicy.Statement.forEach((statement) => {
      serviceAccount.addToPrincipalPolicy(iam.PolicyStatement.fromJson(statement));
    });

    const albController = cluster.addHelmChart('awsLoadBalancerController', {
      chart: 'aws-load-balancer-controller',
      namespace: 'kube-system',
      release: 'demo',
      repository: 'https://aws.github.io/eks-charts',
      values: {
        clusterName: cluster.clusterName,
        serviceAccount: {
          create: false,
          name: 'aws-load-balancer-controller',
        }
      }
    })

    // install alb and target group
    const lb = new elbv2.ApplicationLoadBalancer(this, 'LB', {
      vpc: cluster.vpc,
      internetFacing: true
    });
    const listener = lb.addListener('Listener', {
      port: 80,
      open: true,
    });
    const tg1 = new elbv2.ApplicationTargetGroup(this, 'TG1', {
      targetType: elbv2.TargetType.IP,
      port: 8080,
      vpc: cluster.vpc,
    });
    listener.addTargetGroups('DefaultTg', { targetGroups: [tg1] });
    lb.connections.allowTo(cluster.clusterSecurityGroup, ec2.Port.allTcp())

    // create alarm on metricActiveConnectionCount
    const activeConnMetric = lb.metricActiveConnectionCount()
    new cloudwatch.Alarm(this, 'Alarm', {
      metric: activeConnMetric,
      threshold: 20,
      evaluationPeriods: 3,
    });

    // create k8s app
    const appLabel = { app: "hello-kubernetes" };
    const deployment = {
      apiVersion: "apps/v1",
      kind: "Deployment",
      metadata: { name: "hello-kubernetes" },
      spec: {
        replicas: 3,
        selector: { matchLabels: appLabel },
        template: {
          metadata: { labels: appLabel },
          spec: {
            containers: [
              {
                name: "hello-kubernetes",
                image: "paulbouwer/hello-kubernetes:1.5",
                ports: [{ containerPort: 8080 }],
              },
            ],
          },
        },
      },
    };
    const service = {
      apiVersion: "v1",
      kind: "Service",
      metadata: { name: "hello-kubernetes" },
      spec: {
        type: "ClusterIP",
        ports: [{ port: 80, targetPort: 8080 }],
        selector: appLabel,
      }
    };
    new eks.KubernetesManifest(this, 'hello-kub', {
      cluster,
      manifest: [deployment, service],
    });

    // deploy target group binding resource
    const tgb = {
      apiVersion: "elbv2.k8s.aws/v1beta1",
      kind: "TargetGroupBinding",
      metadata: { name: "hello-kubernetes-tgb" },
      spec: {
        serviceRef: {
          name: "hello-kubernetes",
          port: 80,
        },
        targetGroupARN: tg1.targetGroupArn,
      }
    };

    // todo: resolve the dependency wait here
    // const tgbDeploy = new eks.KubernetesManifest(this, 'hello-kub-tgb', {
    //   cluster,
    //   manifest: [tgb],
    // });
    // tgbDeploy.node.addDependency(albController)

    // output
    new CfnOutput(this, 'AlbCname', { value: lb.loadBalancerDnsName });

  }
}
