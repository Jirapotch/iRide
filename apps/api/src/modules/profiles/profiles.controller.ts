import { authenticateRequest } from "@iride/auth";
import { getApiEnv } from "@iride/config/api";
import { All, Controller, Param, Req, Res } from "@nestjs/common";
import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";

import {
  sendWebResponse,
  toWebRequest,
} from "../../common/http/web-handler.adapter";
import {
  handleGetOwnProfile,
  handleGetPublicProfile,
  handlePatchOwnProfile,
  handleProfileOptions,
  type ProfileDependencies,
} from "../../lib/profiles";
import { TypeOrmProfileRepository } from "./typeorm-profile.repository";

@Controller("api/v1")
export class ProfilesController {
  constructor(private readonly repository: TypeOrmProfileRepository) {}

  @All("profile/me")
  async own(
    @Req() expressRequest: ExpressRequest,
    @Res() expressResponse: ExpressResponse,
  ): Promise<void> {
    const request = toWebRequest(expressRequest);
    const response =
      request.method === "OPTIONS"
        ? handleProfileOptions(request)
        : request.method === "PATCH"
          ? await handlePatchOwnProfile(request, this.dependencies())
          : await handleGetOwnProfile(request, this.dependencies());
    await sendWebResponse(expressResponse, response);
  }

  @All("users/:username")
  async public(
    @Param("username") username: string,
    @Req() expressRequest: ExpressRequest,
    @Res() expressResponse: ExpressResponse,
  ): Promise<void> {
    const request = toWebRequest(expressRequest);
    const response =
      request.method === "OPTIONS"
        ? handleProfileOptions(request)
        : await handleGetPublicProfile(request, username, this.dependencies());
    await sendWebResponse(expressResponse, response);
  }

  private dependencies(): ProfileDependencies {
    const env = getApiEnv();
    return {
      authenticate: (request) =>
        authenticateRequest(request, {
          supabaseUrl: env.SUPABASE_URL,
          publishableKey: env.SUPABASE_PUBLISHABLE_KEY,
        }),
      repository: this.repository,
      allowedOrigins: env.CORS_ALLOWED_ORIGINS,
    };
  }
}
