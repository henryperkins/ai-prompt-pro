import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Bell, Loader2, LogIn, LogOut, Menu, Moon, Sun, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { useToast } from "@/hooks/use-toast";
import { AuthDialog } from "@/components/AuthDialog";
import { NotificationPanel } from "@/components/NotificationPanel";
import { communityFeatureFlags } from "@/lib/feature-flags";
import { APP_ROUTE_NAV_ITEMS, isRouteActive } from "@/lib/navigation";
import { getGravatarUrl } from "@/lib/gravatar";
import { DISPLAY_NAME_MAX_LENGTH, validateDisplayName } from "@/lib/profile";

interface HeaderProps {
  isDark: boolean;
  onToggleTheme: () => void;
}

export function Header({ isDark, onToggleTheme }: HeaderProps) {
  const { user, signOut, updateDisplayName } = useAuth();
  const { toast } = useToast();
  const {
    notifications,
    unreadCount,
    loading: notificationsLoading,
    refresh: refreshNotifications,
    markAsRead: markNotificationAsRead,
    markAllAsRead: markAllNotificationsAsRead,
  } = useNotifications();
  const location = useLocation();
  const [authOpen, setAuthOpen] = useState(false);
  const [desktopNotificationsOpen, setDesktopNotificationsOpen] = useState(false);
  const [mobileNotificationsOpen, setMobileNotificationsOpen] = useState(false);
  const [gravatarUrl, setGravatarUrl] = useState<string | null>(null);
  const [displayNameOpen, setDisplayNameOpen] = useState(false);
  const [displayNameDraft, setDisplayNameDraft] = useState("");
  const [displayNameError, setDisplayNameError] = useState("");
  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const mobileNotificationsEnabled = communityFeatureFlags.communityMobileEnhancements;

  const unreadCountLabel = unreadCount > 99 ? "99+" : String(unreadCount);

  const oauthAvatar = user?.user_metadata?.avatar_url as string | undefined;

  useEffect(() => {
    if (oauthAvatar || !user?.email) {
      setGravatarUrl(null);
      return;
    }
    let cancelled = false;
    getGravatarUrl(user.email, 80).then((url) => {
      if (!cancelled) setGravatarUrl(url);
    });
    return () => { cancelled = true; };
  }, [oauthAvatar, user?.email]);

  const avatarSrc = oauthAvatar || gravatarUrl || undefined;

  const metadataDisplayName =
    typeof user?.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name.trim()
      : "";
  const metadataFullName =
    typeof user?.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.trim()
      : "";
  const initialsSource = metadataDisplayName || metadataFullName || user?.email || "";
  const initials = initialsSource
    ? initialsSource
        .split(" ")
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => value[0] || "")
        .join("")
        .slice(0, 2)
        .toUpperCase() || initialsSource[0]?.toUpperCase() || "?"
    : "?";

  const openDisplayNameDialog = () => {
    setDisplayNameDraft(metadataDisplayName);
    setDisplayNameError("");
    setDisplayNameOpen(true);
  };

  const openMobileNotifications = useCallback(() => {
    setMobileNotificationsOpen(true);
    void refreshNotifications();
  }, [refreshNotifications]);

  // Auto-close drawer if viewport crosses sm breakpoint (e.g. device rotation)
  useEffect(() => {
    if (!mobileNotificationsOpen) return;
    const mq = window.matchMedia("(min-width: 640px)");
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setMobileNotificationsOpen(false);
    };
    if (mq.matches) {
      setMobileNotificationsOpen(false);
      return;
    }
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mobileNotificationsOpen]);

  const handleDisplayNameSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = displayNameDraft.trim();
    const validationError = validateDisplayName(normalized);
    if (validationError) {
      setDisplayNameError(validationError);
      return;
    }

    setSavingDisplayName(true);
    const result = await updateDisplayName(normalized);
    setSavingDisplayName(false);
    if (result.error) {
      setDisplayNameError(result.error);
      return;
    }

    setDisplayNameOpen(false);
    setDisplayNameError("");
    toast({ title: "Display name updated" });
  };

  return (
    <>
      <header className="border-b border-border/80 bg-card/75 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between h-12 sm:h-14 px-3 sm:px-4">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="interactive-chip flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary text-primary-foreground">
              <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <span className="text-base sm:text-lg font-bold text-foreground tracking-tight">PromptForge</span>
          </div>

          <nav className="flex items-center gap-0.5 sm:gap-1">
            {user && mobileNotificationsEnabled && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Open notifications"
                className="interactive-chip relative w-11 h-11 sm:hidden"
                data-testid="mobile-notifications-trigger"
                onClick={openMobileNotifications}
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 py-0.5 text-xs font-semibold leading-none text-destructive-foreground">
                    {unreadCountLabel}
                  </span>
                )}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Open utilities menu"
                  className="interactive-chip w-11 h-11 sm:hidden"
                >
                  <Menu className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="sm:hidden min-w-[220px]">
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    onToggleTheme();
                  }}
                >
                  {isDark ? <Sun className="w-4 h-4 mr-2" /> : <Moon className="w-4 h-4 mr-2" />}
                  {isDark ? "Switch to light mode" : "Switch to dark mode"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {user ? (
                  <>
                    {!mobileNotificationsEnabled && (
                      <>
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger
                            className="gap-2"
                            data-testid="mobile-notifications-menu-item"
                          >
                            <Bell className="w-4 h-4" />
                            Notifications
                            {unreadCount > 0 && (
                              <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-xs font-semibold leading-none text-primary-foreground">
                                {unreadCountLabel}
                              </span>
                            )}
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="border-none bg-transparent p-0 shadow-none">
                            <NotificationPanel
                              notifications={notifications}
                              unreadCount={unreadCount}
                              loading={notificationsLoading}
                              onMarkAsRead={markNotificationAsRead}
                              onMarkAllAsRead={markAllNotificationsAsRead}
                              onRefresh={refreshNotifications}
                              onNavigate={() => setMobileNotificationsOpen(false)}
                            />
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                      {user.email}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault();
                        openDisplayNameDialog();
                      }}
                    >
                      Edit display name
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault();
                        void signOut();
                      }}
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign out
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      setAuthOpen(true);
                    }}
                  >
                    <LogIn className="w-4 h-4 mr-2" />
                    Sign in
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            {APP_ROUTE_NAV_ITEMS.map(({ to, label, icon: Icon, ariaLabel }) => (
              <Button
                key={to}
                asChild
                variant={isRouteActive(location.pathname, to) ? "outline" : "ghost"}
                size="sm"
                className="interactive-chip hidden sm:inline-flex gap-1.5 sm:gap-2 h-11 sm:h-9 px-2 sm:px-3"
              >
                <Link to={to} aria-label={ariaLabel}>
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline text-sm">{label}</span>
                </Link>
              </Button>
            ))}
            {user && (
              <Popover
                open={desktopNotificationsOpen}
                onOpenChange={(open) => {
                  setDesktopNotificationsOpen(open);
                  if (open) {
                    void refreshNotifications();
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Open notifications"
                    className="interactive-chip hidden sm:inline-flex relative w-11 h-11 sm:w-9 sm:h-9"
                  >
                    <Bell className="w-4 h-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 py-0.5 text-xs font-semibold leading-none text-destructive-foreground">
                        {unreadCountLabel}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  sideOffset={8}
                  className="w-auto border-none bg-transparent p-0 shadow-none"
                >
                  <NotificationPanel
                    notifications={notifications}
                    unreadCount={unreadCount}
                    loading={notificationsLoading}
                    onMarkAsRead={markNotificationAsRead}
                    onMarkAllAsRead={markAllNotificationsAsRead}
                    onRefresh={refreshNotifications}
                    onNavigate={() => setDesktopNotificationsOpen(false)}
                  />
                </PopoverContent>
              </Popover>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleTheme}
              aria-label="Toggle theme"
              className="interactive-chip hidden sm:inline-flex w-11 h-11 sm:w-9 sm:h-9"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Open account menu"
                    className="interactive-chip hidden sm:inline-flex w-11 h-11 sm:w-9 sm:h-9 rounded-full p-0"
                  >
                    <Avatar className="w-7 h-7 sm:w-8 sm:h-8">
                      <AvatarImage src={avatarSrc} />
                      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                    {user.email}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={openDisplayNameDialog}>
                    Edit display name
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => signOut()}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAuthOpen(true)}
                aria-label="Sign in"
                className="interactive-chip hidden sm:inline-flex gap-1.5 sm:gap-2 h-11 sm:h-9 px-2 sm:px-3"
              >
                <LogIn className="w-4 h-4" />
                <span className="sr-only sm:not-sr-only sm:inline text-sm">Sign in</span>
              </Button>
            )}
          </nav>
        </div>
      </header>

      {user && mobileNotificationsEnabled && (
        <Drawer
          open={mobileNotificationsOpen}
          onOpenChange={(open) => {
            setMobileNotificationsOpen(open);
            if (open) {
              void refreshNotifications();
            }
          }}
        >
          <DrawerContent
            className="max-h-[82vh] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden"
            aria-describedby={undefined}
            data-testid="mobile-notifications-sheet"
          >
            <DrawerHeader className="pb-1">
              <DrawerTitle className="text-base">Notifications</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <NotificationPanel
                notifications={notifications}
                unreadCount={unreadCount}
                loading={notificationsLoading}
                onMarkAsRead={markNotificationAsRead}
                onMarkAllAsRead={markAllNotificationsAsRead}
                onRefresh={refreshNotifications}
                onNavigate={() => setMobileNotificationsOpen(false)}
                className="w-full border-none bg-transparent shadow-none"
              />
            </div>
          </DrawerContent>
        </Drawer>
      )}

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
      <Dialog
        open={displayNameOpen}
        onOpenChange={(open) => {
          setDisplayNameOpen(open);
          if (!open) {
            setDisplayNameError("");
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit display name</DialogTitle>
            <DialogDescription>
              Update the public name shown on your profile and community posts.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={handleDisplayNameSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="display-name">Display name</Label>
              <Input
                id="display-name"
                value={displayNameDraft}
                onChange={(event) => {
                  setDisplayNameDraft(event.target.value);
                  if (displayNameError) {
                    setDisplayNameError("");
                  }
                }}
                autoComplete="nickname"
                maxLength={DISPLAY_NAME_MAX_LENGTH}
                placeholder="Letters and numbers only"
                aria-invalid={displayNameError ? true : undefined}
              />
              <p className="text-xs text-muted-foreground">
                Use letters and numbers only. Max {DISPLAY_NAME_MAX_LENGTH} characters.
              </p>
            </div>
            {displayNameError && (
              <p className="text-sm text-destructive">{displayNameError}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDisplayNameOpen(false)}
                disabled={savingDisplayName}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={savingDisplayName}>
                {savingDisplayName && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
