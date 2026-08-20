import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/components/locale-provider";
import { LocaleSwitcher } from "@/components/locale-switcher";

const navigation = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: navigation.refresh }),
}));

function renderSwitcher() {
  return render(
    <LocaleProvider initialLocale="th">
      <LocaleSwitcher />
    </LocaleProvider>,
  );
}

describe("LocaleProvider", () => {
  afterEach(cleanup);

  beforeEach(() => {
    localStorage.clear();
    document.cookie = "iride-locale=;path=/;max-age=0";
    document.documentElement.lang = "";
    navigation.refresh.mockClear();
  });

  it("defaults to Thai and persists the default", async () => {
    renderSwitcher();

    await waitFor(() => expect(localStorage.getItem("iride-locale")).toBe("th"));
    expect(document.documentElement.lang).toBe("th");
    expect(document.cookie).toContain("iride-locale=th");
    expect(screen.getByRole("button", { name: /EN/i })).toBeInTheDocument();
  });

  it("uses a stored English preference and refreshes server content", async () => {
    localStorage.setItem("iride-locale", "en");
    renderSwitcher();

    await waitFor(() => expect(screen.getByRole("button", { name: /TH/i })).toBeInTheDocument());
    expect(document.documentElement.lang).toBe("en");
    expect(document.cookie).toContain("iride-locale=en");
    expect(navigation.refresh).toHaveBeenCalled();
  });

  it("replaces an unsupported stored value with Thai", async () => {
    localStorage.setItem("iride-locale", "jp");
    renderSwitcher();

    await waitFor(() => expect(localStorage.getItem("iride-locale")).toBe("th"));
    expect(document.documentElement.lang).toBe("th");
  });

  it("switches language without navigating", async () => {
    renderSwitcher();
    fireEvent.click(screen.getByRole("button", { name: /EN/i }));

    await waitFor(() => expect(localStorage.getItem("iride-locale")).toBe("en"));
    expect(document.cookie).toContain("iride-locale=en");
    expect(document.documentElement.lang).toBe("en");
    expect(screen.getByRole("button", { name: /TH/i })).toBeInTheDocument();
    expect(navigation.refresh).toHaveBeenCalled();
  });
});
