import { All, Controller, Req, Res } from "@nestjs/common";
import type { Request as ExpressRequest, Response as ExpressResponse } from "express";

import { handleAdminModeration, handleAdminModerationOptions } from "../../lib/admin-moderation";
import { handleAdminUser, handleAdminUsers, handleAdminUsersOptions } from "../../lib/admin-users";
import { handleAuthMe, handleAuthOptions } from "../../lib/auth-me";
import {
  handleContentCollection,
  handleContentItem,
  handleContentOptions,
  handleExplore,
  handleSearch,
} from "../../lib/content";
import {
  handleMediaComplete,
  handleMediaOptions,
  handleMediaUpload,
  handleMediaVariant,
} from "../../lib/media";
import {
  handleGetOwnProfile,
  handleGetPublicProfile,
  handlePatchOwnProfile,
  handleProfileOptions,
} from "../../lib/profiles";
import {
  handleCommentItem,
  handleCommentsCollection,
  handleGarage,
  handleProfileActivities,
  handleSocialOptions,
  handleVehicleCollection,
  handleVehicleItem,
} from "../../lib/social";
import { sendWebResponse, toWebRequest } from "../../common/http/web-handler.adapter";

@Controller()
export class LegacyApiController {
  @All("api/v1/*path")
  async handle(
    @Req() expressRequest: ExpressRequest,
    @Res() expressResponse: ExpressResponse,
  ): Promise<void> {
    const request = toWebRequest(expressRequest);
    const response = await dispatch(request, expressRequest.path);
    await sendWebResponse(expressResponse, response);
  }
}

async function dispatch(request: Request, path: string): Promise<Response> {
  const method = request.method;
  const options = method === "OPTIONS";

  if (path === "/api/v1/auth/me") {
    return options ? handleAuthOptions(request) : handleAuthMe(request);
  }
  if (path === "/api/v1/profile/me") {
    if (options) return handleProfileOptions(request);
    return method === "PATCH"
      ? handlePatchOwnProfile(request)
      : handleGetOwnProfile(request);
  }
  if (path === "/api/v1/admin/users") {
    return options ? handleAdminUsersOptions(request) : handleAdminUsers(request);
  }
  if (path === "/api/v1/admin/moderation") {
    return options
      ? handleAdminModerationOptions(request)
      : handleAdminModeration(request);
  }
  if (path === "/api/v1/posts") {
    return options
      ? handleContentOptions(request)
      : handleContentCollection(request, "posts");
  }
  if (path === "/api/v1/events") {
    return options
      ? handleContentOptions(request)
      : handleContentCollection(request, "events");
  }
  if (path === "/api/v1/explore") {
    return options ? handleContentOptions(request) : handleExplore(request);
  }
  if (path === "/api/v1/search") {
    return options ? handleContentOptions(request) : handleSearch(request);
  }
  if (path === "/api/v1/vehicles") {
    return options
      ? handleSocialOptions(request)
      : handleVehicleCollection(request);
  }
  if (path === "/api/v1/media/uploads") {
    return options ? handleMediaOptions(request) : handleMediaUpload(request);
  }

  const adminUser = match(path, /^\/api\/v1\/admin\/users\/([^/]+)$/);
  if (adminUser) {
    return options
      ? handleAdminUsersOptions(request)
      : handleAdminUser(request, adminUser);
  }
  const publicProfile = match(path, /^\/api\/v1\/users\/([^/]+)$/);
  if (publicProfile) {
    return options
      ? handleProfileOptions(request)
      : handleGetPublicProfile(request, publicProfile);
  }
  const activities = match(path, /^\/api\/v1\/users\/([^/]+)\/activities$/);
  if (activities) {
    return options
      ? handleSocialOptions(request)
      : handleProfileActivities(request, activities);
  }
  const garage = match(path, /^\/api\/v1\/users\/([^/]+)\/garage$/);
  if (garage) {
    return options ? handleSocialOptions(request) : handleGarage(request, garage);
  }
  const postComments = match(path, /^\/api\/v1\/posts\/([^/]+)\/comments$/);
  if (postComments) {
    return options
      ? handleSocialOptions(request)
      : handleCommentsCollection(request, postComments);
  }
  const post = match(path, /^\/api\/v1\/posts\/([^/]+)$/);
  if (post) {
    return options
      ? handleContentOptions(request)
      : handleContentItem(request, "posts", post);
  }
  const event = match(path, /^\/api\/v1\/events\/([^/]+)$/);
  if (event) {
    return options
      ? handleContentOptions(request)
      : handleContentItem(request, "events", event);
  }
  const comment = match(path, /^\/api\/v1\/comments\/([^/]+)$/);
  if (comment) {
    return options
      ? handleSocialOptions(request)
      : handleCommentItem(request, comment);
  }
  const vehicle = match(path, /^\/api\/v1\/vehicles\/([^/]+)$/);
  if (vehicle) {
    return options
      ? handleSocialOptions(request)
      : handleVehicleItem(request, vehicle);
  }
  const mediaComplete = match(path, /^\/api\/v1\/media\/([^/]+)\/complete$/);
  if (mediaComplete) {
    return options
      ? handleMediaOptions(request)
      : handleMediaComplete(request, mediaComplete);
  }
  const mediaVariant = /^\/api\/v1\/media\/([^/]+)\/variants\/([^/]+)$/.exec(path);
  if (mediaVariant?.[1] && mediaVariant[2]) {
    return options
      ? handleMediaOptions(request)
      : handleMediaVariant(
          request,
          decodeURIComponent(mediaVariant[1]),
          decodeURIComponent(mediaVariant[2]),
        );
  }

  return Response.json(
    { error: { code: "NOT_FOUND", message: "Route was not found." } },
    { status: 404 },
  );
}

function match(path: string, pattern: RegExp): string | null {
  const value = pattern.exec(path)?.[1];
  return value ? decodeURIComponent(value) : null;
}
