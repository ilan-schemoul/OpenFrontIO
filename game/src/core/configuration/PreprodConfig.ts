import { GameEnv } from "@openfrontio/shared/src/Utils";
import { DefaultConfig, DefaultServerConfig } from "./DefaultConfig";

export const preprodConfig = new (class extends DefaultServerConfig {
  env(): GameEnv {
    return GameEnv.Preprod;
  }
  discordRedirectURI(): string {
    return "https://openfront.dev/auth/callback";
  }
})();
