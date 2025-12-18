import * as pulumi from "@pulumi/pulumi"

// Get the current stack name to determine which resources to create
const stackName = pulumi.getStack()

// Export based on stack
if (stackName === "shared") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  module.exports = require("./stacks/shared")
} else if (stackName === "dev") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  module.exports = require("./stacks/dev")
} else if (stackName === "prod") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  module.exports = require("./stacks/prod")
} else {
  throw new Error(`Unknown stack: ${stackName}. Valid stacks are: shared, dev, prod`)
}

