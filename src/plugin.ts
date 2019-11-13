import * as assert from 'assert'
import * as _ from 'lodash'
import * as util from 'util'

import Policy from './aws/policy'
import Role from './aws/role'
import Target from './aws/target'

const text = {
  CLI_DONE: 'Added Kinesis Auto Scaling to CloudFormation!',
  CLI_RESOURCE: ' - Building configuration for resource "stream/%s%s"',
  CLI_SKIP: 'Skipping Kinesis Auto Scaling: %s!',
  CLI_START: 'Configure Kinesis Auto Scaling …',
  INVALID_CONFIGURATION: 'Invalid serverless configuration',
  NO_AUTOSCALING_CONFIG: 'Not Auto Scaling configuration found',
  ONLY_AWS_SUPPORT: 'Only supported for AWS provicer'
}

interface Defaults {
  shards: CapacityConfiguration
}

class AWSKinesisAutoScaling {
  public hooks: {}

  /**
   * Constructur
   */
  constructor (private serverless: Serverless) {
    this.hooks = {
      'package:compileEvents': this.beforeDeployResources.bind(this)
    }
  }

  /**
   * Get the current stage name
   */
  private getStage(): string {
    return this.serverless.getProvider('aws').getStage()
  }

  /**
   * Get the current service name
   */
  private getServiceName(): string {
    return this.serverless.service.getServiceName()
  }

  /**
   * Get the current service region
   */
  private getRegion(): string {
    return this.serverless.getProvider('aws').getRegion()
  }

  /**
   * Validate the request and check if configuration is available
   */
  private validate(): void {
    assert(this.serverless, text.INVALID_CONFIGURATION)
    assert(this.serverless.service, text.INVALID_CONFIGURATION)
    assert(this.serverless.service.provider, text.INVALID_CONFIGURATION)
    assert(this.serverless.service.provider.name, text.INVALID_CONFIGURATION)
    assert(this.serverless.service.provider.name === 'aws', text.ONLY_AWS_SUPPORT)

    assert(this.serverless.service.custom, text.NO_AUTOSCALING_CONFIG)
    assert(this.serverless.service.custom.capacities, text.NO_AUTOSCALING_CONFIG)
  }

  /**
   * Parse configuration and fill up with default values when needed
   */
  private defaults(config: Capacity): Defaults {
    return {
      shards: {
        maximum: config.shards && config.shards.maximum ? config.shards.maximum : 200,
        minimum: config.shards && config.shards.minimum ? config.shards.minimum : 5,
        usage: config.shards && config.shards.usage ? config.shards.usage : 0.75
      }
    }
  }

  /**
   * Create CloudFormation resources for stream (and optional index)
   */
  private resources(stream: string, config: Capacity): any[] {
    const data = this.defaults(config)

    const options: Options = {
      region: this.getRegion(),
      service: this.getServiceName(),
      stage: this.getStage(),
      stream
    }

    // Start processing configuration
    this.serverless.cli.log(
      util.format(text.CLI_RESOURCE, stream)
    )

    // Add role to manage Auto Scaling policies
    const resources: any[] = [
      new Role(options)
    ]

    // Only add Auto Scaling for read capacity if configuration set is available
    if (!!config.shards) {
      resources.push(...this.getPolicyAndTarget(options, data.shards, true))
    }

    return resources
  }

  /**
   * Create Policy and Target resource
   */
  private getPolicyAndTarget(options: Options, data: CapacityConfiguration, read: boolean): any[] {
    return [
      new Policy(options, read, data.usage * 100, 60, 60),
      new Target(options, read, data.minimum, data.maximum)
    ]
  }

  /**
   * Generate CloudFormation resources for Kinesis stream
   */
  private generate(stream: string, config: Capacity) {
    let resources: any[] = []
    let lastRessources: any[] = []

    const current = this.resources(stream, config).map(
      (resource: any) => resource.setDependencies(lastRessources).toJSON()
    )

    resources = resources.concat(current)
    lastRessources = current.map((item: any) => Object.keys(item).pop())

    return resources
  }

  /**
   * Check if parameter is defined and return as array if only a string is provided
   */
  private normalize(data: string|string[]): string[] {
    if (data && data.constructor !== Array) {
      return [ data as string ]
    }

    return (data as string[] || []).slice(0)
  }

  /**
   * Process the provided configuration
   */
  private process() {
    this.serverless.service.custom.capacities.filter(
      (config: Capacity) => !!config.shards
    ).forEach(
      (config: Capacity) => this.normalize(config.stream).forEach(
        (stream: string) => this.generate(stream, config).forEach(
          (resource: string) => _.merge(
            this.serverless.service.provider.compiledCloudFormationTemplate.Resources,
            resource
          )
        )
      )
    )
  }

  private beforeDeployResources(): Promise<any> {
    return Promise.resolve().then(
      () => this.validate()
    ).then(
      () => this.serverless.cli.log(util.format(text.CLI_START))
    ).then(
      () => this.process()
    ).then(
      () => this.serverless.cli.log(util.format(text.CLI_DONE))
    ).catch(
      (err: Error) => this.serverless.cli.log(util.format(text.CLI_SKIP, err.message))
    )
  }
}

module.exports = AWSKinesisAutoScaling
