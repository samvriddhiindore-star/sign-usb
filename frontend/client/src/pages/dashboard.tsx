import { useState, useEffect } from "react";
import {
  Shield, Activity, Lock, Unlock, WifiOff, Wifi,
  Usb, Calendar, MonitorCheck, TrendingUp,
  CheckCircle2, XCircle
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatDistanceToNow, format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

// Animated Counter Component
function AnimatedCounter({ value, duration = 2000 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);

      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setDisplayValue(Math.floor(value * easeOutQuart));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration]);

  return <span>{displayValue.toLocaleString()}</span>;
}

// Progress Ring Component
function ProgressRing({
  percentage,
  size = 60,
  strokeWidth = 6,
  color = "text-primary"
}: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-muted opacity-20"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={color}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold">{Math.round(percentage)}%</span>
      </div>
    </div>
  );
}

// Enhanced KPI Card Component - Standardized Design
function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = "primary",
  percentage,
  delay = 0
}: {
  title: string;
  value: number;
  subtitle?: string;
  icon: React.ElementType;
  color?: "primary" | "emerald" | "amber" | "sky" | "rose" | "indigo" | "teal" | "orange";
  percentage?: number;
  delay?: number;
}) {
  const colorClasses = {
    primary: {
      border: "border-primary/20",
      bg: "from-primary/10 via-primary/5 to-transparent",
      icon: "text-primary",
      value: "text-primary",
      accent: "bg-primary/10"
    },
    emerald: {
      border: "border-emerald-500/20",
      bg: "from-emerald-500/10 via-emerald-500/5 to-transparent",
      icon: "text-emerald-500",
      value: "text-emerald-600 dark:text-emerald-400",
      accent: "bg-emerald-500/10"
    },
    amber: {
      border: "border-amber-500/20",
      bg: "from-amber-500/10 via-amber-500/5 to-transparent",
      icon: "text-amber-500",
      value: "text-amber-600 dark:text-amber-400",
      accent: "bg-amber-500/10"
    },
    sky: {
      border: "border-sky-500/20",
      bg: "from-sky-500/10 via-sky-500/5 to-transparent",
      icon: "text-sky-500",
      value: "text-sky-600 dark:text-sky-400",
      accent: "bg-sky-500/10"
    },
    rose: {
      border: "border-rose-500/20",
      bg: "from-rose-500/10 via-rose-500/5 to-transparent",
      icon: "text-rose-500",
      value: "text-rose-600 dark:text-rose-400",
      accent: "bg-rose-500/10"
    },
    purple: {
      border: "border-purple-500/20",
      bg: "from-purple-500/10 via-purple-500/5 to-transparent",
      icon: "text-purple-500",
      value: "text-purple-600 dark:text-purple-400",
      accent: "bg-purple-500/10"
    },
    indigo: {
      border: "border-indigo-500/20",
      bg: "from-indigo-500/10 via-indigo-500/5 to-transparent",
      icon: "text-indigo-500",
      value: "text-indigo-600 dark:text-indigo-400",
      accent: "bg-indigo-500/10"
    },
    teal: {
      border: "border-teal-500/20",
      bg: "from-teal-500/10 via-teal-500/5 to-transparent",
      icon: "text-teal-500",
      value: "text-teal-600 dark:text-teal-400",
      accent: "bg-teal-500/10"
    },
    orange: {
      border: "border-orange-500/20",
      bg: "from-orange-500/10 via-orange-500/5 to-transparent",
      icon: "text-orange-500",
      value: "text-orange-600 dark:text-orange-400",
      accent: "bg-orange-500/10"
    }
  };

  const colors = colorClasses[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      <Card className={`relative overflow-hidden border-2 ${colors.border} bg-gradient-to-br ${colors.bg} hover:shadow-lg transition-all duration-300 group`}>
        {/* Animated background pattern */}
        <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${colors.accent}`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_50%)]" />
        </div>

        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative z-10">
          <CardTitle className="text-sm font-medium text-foreground/80">{title}</CardTitle>
          <motion.div
            className={`p-2 rounded-lg ${colors.accent} backdrop-blur-sm`}
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            <Icon className={`h-5 w-5 ${colors.icon}`} />
          </motion.div>
        </CardHeader>

        <CardContent className="relative z-10">
          <div className="flex items-center justify-between gap-4 min-h-[120px]">
            <div className="flex-1 min-w-0">
              <motion.div
                className={`text-4xl font-bold ${colors.value} mb-2`}
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5, delay: delay + 0.2 }}
              >
                <AnimatedCounter value={value} />
              </motion.div>
              {subtitle && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {subtitle}
                </p>
              )}
              {percentage !== undefined && (
                <div className="mt-3">
                  <Progress value={percentage} className="h-2" />
                </div>
              )}
            </div>

            {percentage !== undefined ? (
              <div className="flex-shrink-0">
                <ProgressRing
                  percentage={percentage}
                  size={70}
                  strokeWidth={6}
                  color={colors.icon}
                />
              </div>
            ) : (
              <div className="flex-shrink-0 w-[70px] h-[70px] flex items-center justify-center">
                <div className={`h-12 w-12 rounded-full ${colors.accent} flex items-center justify-center`}>
                  <Icon className={`h-6 w-6 ${colors.icon}`} />
                </div>
              </div>
            )}
          </div>
        </CardContent>

        {/* Decorative corner accent */}
        <div className={`absolute top-0 right-0 w-20 h-20 ${colors.accent} opacity-20 rounded-bl-full blur-2xl`} />
      </Card>
    </motion.div>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: api.getDashboardStats,
    refetchInterval: 30000
  });

  const { data: usbLogs } = useQuery({
    queryKey: ['usb-logs-recent'],
    queryFn: () => api.getUsbLogs(10),
    refetchInterval: 15000
  });

  const { data: connectedDevices } = useQuery({
    queryKey: ['connected-devices'],
    queryFn: api.getConnectedUsbDevices,
    refetchInterval: 10000
  });

  // Calculate percentages and trends
  const onlinePercentage = stats?.totalSystems
    ? Math.round((stats.onlineSystems / stats.totalSystems) * 100)
    : 0;

  const usbDisabledPercentage = stats?.totalSystems
    ? Math.round((stats.usbDisabledSystems / stats.totalSystems) * 100)
    : 0;

  if (statsLoading) {
    return (
      <Layout>
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Loading your security overview...</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(9)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-3 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header with animated title */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                Security Dashboard
              </h1>
              <p className="text-muted-foreground mt-2">
                Real-time overview of your USB security & system status
              </p>
            </div>
            <motion.div
              className="hidden md:flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/20"
              animate={{
                boxShadow: [
                  "0 0 0px rgba(59, 130, 246, 0)",
                  "0 0 20px rgba(59, 130, 246, 0.3)",
                  "0 0 0px rgba(59, 130, 246, 0)"
                ]
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm font-medium">Live</span>
            </motion.div>
          </div>
        </motion.div>

        {/* KPI Cards - Unified Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <KPICard
            title="Total Systems"
            value={stats?.totalSystems || 0}
            subtitle="Registered machines"
            icon={MonitorCheck}
            color="primary"
            delay={0.1}
          />

          <KPICard
            title="Online Systems"
            value={stats?.onlineSystems || 0}
            subtitle={`${onlinePercentage}% of fleet connected`}
            icon={Wifi}
            color="emerald"
            percentage={onlinePercentage}
            delay={0.2}
          />

          <KPICard
            title="Offline Systems"
            value={stats?.offlineSystems || 0}
            subtitle="Requires attention"
            icon={WifiOff}
            color="amber"
            percentage={stats?.totalSystems ? Math.round((stats.offlineSystems / stats.totalSystems) * 100) : 0}
            delay={0.3}
          />

          <KPICard
            title="Active USB Devices"
            value={connectedDevices?.length || 0}
            subtitle="Currently connected"
            icon={Activity}
            color="orange"
            delay={0.4}
          />

          <KPICard
            title="USB Enabled"
            value={stats?.usbEnabledSystems || 0}
            subtitle="Ports unlocked"
            icon={Unlock}
            color="sky"
            percentage={stats?.totalSystems ? Math.round((stats.usbEnabledSystems / stats.totalSystems) * 100) : 0}
            delay={0.5}
          />

          <KPICard
            title="USB Disabled"
            value={stats?.usbDisabledSystems || 0}
            subtitle={`${usbDisabledPercentage}% protection`}
            icon={Lock}
            color="rose"
            percentage={usbDisabledPercentage}
            delay={0.6}
          />

          <KPICard
            title="USB Events Today"
            value={stats?.usbEventsToday || 0}
            subtitle="Device connections"
            icon={Usb}
            color="indigo"
            delay={0.7}
          />

          <KPICard
            title="USB Events (7 Days)"
            value={stats?.usbEventsLast7Days || 0}
            subtitle="Weekly activity"
            icon={Calendar}
            color="teal"
            delay={0.8}
          />
        </div>

        {/* Activity Panels with Enhanced Design */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          {/* Recent USB Activity */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 1 }}
            className="col-span-4"
          >
            <Card className="h-full border-2 border-border/50 hover:border-primary/20 transition-colors">
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Usb className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Recent USB Activity</CardTitle>
                      <CardDescription>Latest connection events across the fleet</CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="animate-pulse">
                    Live
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  {usbLogs && usbLogs.length > 0 ? (
                    usbLogs.slice(0, 6).map((log, index) => (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 1.1 + index * 0.1 }}
                        className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/60 transition-all group border border-transparent hover:border-primary/20"
                      >
                        <motion.div
                          className={`h-12 w-12 rounded-xl flex items-center justify-center shadow-sm ${log.status === 'Connected'
                              ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30'
                              : 'bg-gradient-to-br from-slate-500/20 to-slate-600/10 border border-slate-500/30'
                            }`}
                          whileHover={{ scale: 1.1, rotate: 5 }}
                        >
                          <Usb className={`h-6 w-6 ${log.status === 'Connected' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'
                            }`} />
                        </motion.div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                            {log.deviceName}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                            <span>{log.pcName}</span>
                            <span>•</span>
                            <span>{log.devicePort || 'N/A'}</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge
                            variant={log.status === 'Connected' ? 'default' : 'secondary'}
                            className="mb-1 shadow-sm"
                          >
                            {log.status === 'Connected' ? (
                              <><CheckCircle2 className="h-3 w-3 mr-1" /> Connected</>
                            ) : (
                              <><XCircle className="h-3 w-3 mr-1" /> Removed</>
                            )}
                          </Badge>
                          <p className="text-xs text-muted-foreground">
                            {log.connectTime ? formatDistanceToNow(new Date(log.connectTime), { addSuffix: true }) : 'Unknown'}
                          </p>
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <motion.div
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                      >
                        <Usb className="h-16 w-16 mx-auto mb-4 opacity-20" />
                      </motion.div>
                      <p className="text-sm">No recent USB activity</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Currently Connected Devices */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 1.2 }}
            className="col-span-3"
          >
            <Card className="h-full border-2 border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent">
              <CardHeader className="border-b border-emerald-500/20">
                <div className="flex items-center gap-3">
                  <motion.div
                    className="p-2 rounded-lg bg-emerald-500/20"
                    animate={{
                      boxShadow: [
                        "0 0 0px rgba(16, 185, 129, 0)",
                        "0 0 15px rgba(16, 185, 129, 0.4)",
                        "0 0 0px rgba(16, 185, 129, 0)"
                      ]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Activity className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </motion.div>
                  <div>
                    <CardTitle>Connected Now</CardTitle>
                    <CardDescription>USB devices currently active</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  {connectedDevices && connectedDevices.length > 0 ? (
                    connectedDevices.slice(0, 5).map((device, index) => (
                      <motion.div
                        key={device.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 1.3 + index * 0.1 }}
                        className="flex items-center justify-between p-3 rounded-lg border-2 border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 backdrop-blur-sm hover:border-emerald-500/50 transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <motion.div
                            className="h-3 w-3 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50"
                            animate={{
                              scale: [1, 1.2, 1],
                              opacity: [1, 0.7, 1]
                            }}
                            transition={{ duration: 2, repeat: Infinity }}
                          />
                          <div>
                            <p className="text-sm font-semibold group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                              {device.pcName}
                            </p>
                            <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                              {device.deviceName}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="border-emerald-500/30 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10">
                          {device.devicePort || 'USB'}
                        </Badge>
                      </motion.div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <Shield className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      </motion.div>
                      <p className="text-sm">No USB devices connected</p>
                      <p className="text-xs mt-1">All systems secure</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Security Status Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.4 }}
        >
          <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 via-background to-background">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Security Status</p>
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      {usbDisabledPercentage >= 80 ? 'Excellent' : usbDisabledPercentage >= 50 ? 'Good' : 'Needs Attention'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-primary/20 border border-primary/30">
                    <TrendingUp className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Fleet Health</p>
                    <p className="text-lg font-bold">
                      {onlinePercentage >= 90 ? 'Optimal' : onlinePercentage >= 70 ? 'Good' : 'Review Needed'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-indigo-500/20 border border-indigo-500/30">
                    <Activity className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Activity Level</p>
                    <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                      {stats && stats.usbEventsToday > 50 ? 'High' : stats && stats.usbEventsToday > 20 ? 'Moderate' : 'Low'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </Layout>
  );
}
