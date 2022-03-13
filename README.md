# Target Group Binding Demo

This is a demo project to show how to use target group binding in EKS with AWS Load Balancer Controller. Target group binding allows us to create ingress for Kubernetes apps with existing AWS Application Load Balancers. This will allow you to provision the load balancer infrastructure completely outside of Kubernetes but still manage the targets with Kubernetes Service

## Architecture

![CDK Target Group Bindings Demo!](/docs/cdk-target-group-bindings.png)

## Use Cases

- You have an existing ALB to add new services/targets to.
- You want to create CloudWatch metrics/alarms along with the ALB or Target Groups. Creating them in K8s using `ingress` makes hard for you to setup CloudWatch metrics/alarms automatically. It is easier to create ALB and Target Groups in one place using CDK/CFN/Terraform etc and leverage target group bindings for connecting pods.
- Other reasons you need to manage ALB or target groups outside of Kubernetes.
- If you’ve experienced API limits in the past, this new controller greatly reduces the API calls needed by using TargetGroupBindings. Instead of needing to update the ALB every time the target pods change (e.g. during scale events), the controller only needs to call the AWS APIs to update targets of TargetGroup directly.

## How to deploy this demo

- `npm i`   compile typescript to js
- `npm run build`   compile typescript to js
- `npx cdk deploy`   watch for changes and compile

![Deployed App!](/docs/hello-k8s.png)

## Useful links

- [TargetGroupBinding](https://kubernetes-sigs.github.io/aws-load-balancer-controller/v2.1/guide/targetgroupbinding/targetgroupbinding/)
