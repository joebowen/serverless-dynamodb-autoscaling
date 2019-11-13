declare interface Capacity {
  stream: string | string[]
  shards?: CapacityConfiguration
}

declare interface CapacityConfiguration {
  maximum: number
  minimum: number
  usage: number
}

declare interface Options {
  region: string
  service: string
  stage: string
  stream: string
}

/**
 * Merged with empty default Serverless.Service.Custom declaration
 */
declare namespace Serverless {
  namespace Service {
    interface Custom {
      capacities: Capacity[]
    }
  }
}