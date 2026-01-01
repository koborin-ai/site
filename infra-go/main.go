package main

import (
	"fmt"
	"os"

	"github.com/nozomi-koborinai/koborin-ai/infra-go/stacks"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

func main() {
	// Get the current stack name from PULUMI_STACK environment variable
	// or use the default mechanism via pulumi.Run
	pulumi.Run(func(ctx *pulumi.Context) error {
		stackName := ctx.Stack()

		switch stackName {
		case "shared":
			return stacks.Shared(ctx)
		case "dev":
			return stacks.Dev(ctx)
		case "prod":
			return stacks.Prod(ctx)
		default:
			fmt.Fprintf(os.Stderr, "Unknown stack: %s. Valid stacks are: shared, dev, prod\n", stackName)
			return fmt.Errorf("unknown stack: %s", stackName)
		}
	})
}

