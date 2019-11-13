import Resource from './resource'

export default class Role extends Resource {
  private readonly type: string = 'AWS::IAM::Role'
  private readonly version: string = '2012-10-17'
  private readonly actions = {
    CloudWatch: [
      'cloudwatch:PutMetricAlarm',
      'cloudwatch:DescribeAlarms',
      'cloudwatch:DeleteAlarms',
      'cloudwatch:GetMetricStatistics',
      'cloudwatch:SetAlarmState'
    ],
    Kinesis: [
      'kinesis:Describe*',
      'kinesis:UpdateShardCount'
    ]
  }

  constructor (
    options: Options
  ) { super(options) }

  public toJSON(): any {
    const RoleName = this.name.role()
    const PolicyName = this.name.policyRole()

    const DependsOn = [ this.options.stream ].concat(this.dependencies)
    const Principal = this.principal()
    const Version = this.version
    const Type = this.type

    return {
      [RoleName]: {
        DependsOn,
        Properties: {
          AssumeRolePolicyDocument: {
            Statement: [
              { Action: 'sts:AssumeRole', Effect: 'Allow', Principal }
            ],
            Version
          },
          Policies: [
            {
              PolicyDocument: {
                Statement: [
                  { Action: this.actions.CloudWatch, Effect: 'Allow', Resource: '*' },
                  { Action: this.actions.Kinesis, Effect: 'Allow', Resource: this.resource() }
                ],
                Version
              },
              PolicyName
            }
          ],
          RoleName
        },
        Type
      }
    }
  }

  private resource(): {} {
    return {
      'Fn::Join': [ '', [ 'arn:aws:kinesis:*:', { Ref: 'AWS::AccountId' }, ':stream/', { Ref: this.options.stream } ] ]
    }
  }

  private principal(): {} {
    return {
      Service: 'application-autoscaling.amazonaws.com'
    }
  }
}
