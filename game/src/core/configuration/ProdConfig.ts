import { GameEnv } from "@openfrontio/shared/src/Utils";
import { DefaultConfig, DefaultServerConfig } from "./DefaultConfig";

export const prodConfig = new (class extends DefaultServerConfig {
  env(): GameEnv {
    return GameEnv.Prod;
  }
  discordRedirectURI(): string {
    return "https://openfront.io/auth/callback";
  }
})();
