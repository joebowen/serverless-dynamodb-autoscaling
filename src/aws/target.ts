import Resource from './resource'

export default class Target extends Resource {
  private readonly type = 'AWS::ApplicationAutoScaling::ScalableTarget'

  constructor (
    options: Options,
    private read: boolean,
    private min: number,
    private max: number
  ) { super(options) }

  public toJSON(): any {
    const resource = [ 'stream/', { Ref: this.options.stream } ]

    const nameTarget = this.name.target(this.read)
    const nameRole = this.name.role()
    const nameDimension = this.name.dimension(this.read)

    const DependsOn = [ this.options.stream, nameRole ].concat(this.dependencies)

    return {
      [nameTarget]: {
        DependsOn,
        Properties: {
          MaxCapacity: this.max,
          MinCapacity: this.min,
          ResourceId: { 'Fn::Join': [ '', resource ] },
          RoleARN: { 'Fn::GetAtt': [ nameRole, 'Arn' ] },
          ScalableDimension: nameDimension,
          ServiceNamespace: 'kinesis'
        },
        Type: this.type
      }
    }
  }
}
