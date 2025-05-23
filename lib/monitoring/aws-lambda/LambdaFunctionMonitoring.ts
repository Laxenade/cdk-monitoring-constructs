import { Duration } from "aws-cdk-lib";
import {
  GraphWidget,
  HorizontalAnnotation,
  IWidget,
  Row,
} from "aws-cdk-lib/aws-cloudwatch";
import { CfnFunction, Function, IFunction } from "aws-cdk-lib/aws-lambda";

import { LambdaFunctionEnhancedMetricFactory } from "./LambdaFunctionEnhancedMetricFactory";
import {
  LambdaFunctionMetricFactory,
  LambdaFunctionMetricFactoryProps,
} from "./LambdaFunctionMetricFactory";
import {
  AgeAlarmFactory,
  AlarmFactory,
  BaseMonitoringProps,
  CountAxisFromZero,
  DefaultGraphWidgetHeight,
  DefaultSummaryWidgetHeight,
  DurationThreshold,
  ErrorAlarmFactory,
  ErrorCountThreshold,
  ErrorRateThreshold,
  ErrorType,
  HalfWidth,
  HighTpsThreshold,
  LatencyAlarmFactory,
  LatencyThreshold,
  LatencyTimeoutPercentageThreshold,
  LatencyType,
  LowTpsThreshold,
  MaxAgeThreshold,
  MaxOffsetLagThreshold,
  MegabyteMillisecondAxisFromZero,
  MetricWithAlarmSupport,
  MinUsageCountThreshold,
  Monitoring,
  MonitoringScope,
  PercentageAxisFromZeroToHundred,
  QuarterWidth,
  RateAxisFromZero,
  RateComputationMethod,
  RunningTaskCountThreshold,
  RunningTaskRateThreshold,
  TaskHealthAlarmFactory,
  ThirdWidth,
  TimeAxisMillisFromZero,
  TpsAlarmFactory,
  UsageAlarmFactory,
  UsageThreshold,
  UsageType,
} from "../../common";
import {
  MonitoringHeaderWidget,
  MonitoringNamingStrategy,
} from "../../dashboard";

export interface LambdaFunctionMonitoringOptions extends BaseMonitoringProps {
  /**
   * Indicates that the Lambda function handles an event source (e.g. DynamoDB event stream).
   * This impacts what widgets are shown, as well as validates the ability to use addMaxIteratorAgeAlarm.
   *
   * @default - true
   */
  readonly isIterator?: boolean;
  /**
   * Indicates that the Lambda function handles an event source which uses offsets for records (e.g. Kafka streams).
   * This impacts what widgets are shown, as well as validates the ability to use addMaxOffsetLagAlarm.
   *
   * @default - false
   */
  readonly isOffsetLag?: boolean;

  readonly addLatencyP50Alarm?: Record<
    string,
    LatencyThreshold | LatencyTimeoutPercentageThreshold
  >;
  readonly addLatencyP90Alarm?: Record<
    string,
    LatencyThreshold | LatencyTimeoutPercentageThreshold
  >;
  readonly addLatencyP99Alarm?: Record<
    string,
    LatencyThreshold | LatencyTimeoutPercentageThreshold
  >;
  readonly addMaxLatencyAlarm?: Record<
    string,
    LatencyThreshold | LatencyTimeoutPercentageThreshold
  >;

  readonly addFaultCountAlarm?: Record<string, ErrorCountThreshold>;
  readonly addFaultRateAlarm?: Record<string, ErrorRateThreshold>;

  readonly addLowTpsAlarm?: Record<string, LowTpsThreshold>;
  readonly addHighTpsAlarm?: Record<string, HighTpsThreshold>;

  readonly addThrottlesCountAlarm?: Record<string, ErrorCountThreshold>;
  readonly addThrottlesRateAlarm?: Record<string, ErrorRateThreshold>;

  readonly addMinInvocationsCountAlarm?: Record<string, MinUsageCountThreshold>;

  readonly addConcurrentExecutionsCountAlarm?: Record<
    string,
    RunningTaskCountThreshold
  >;
  readonly addProvisionedConcurrencySpilloverInvocationsCountAlarm?: Record<
    string,
    RunningTaskCountThreshold
  >;
  readonly addProvisionedConcurrencySpilloverInvocationsRateAlarm?: Record<
    string,
    RunningTaskRateThreshold
  >;
  readonly addMaxIteratorAgeAlarm?: Record<string, MaxAgeThreshold>;

  readonly addMaxOffsetLagAlarm?: Record<string, MaxOffsetLagThreshold>;

  // Enhanced CPU metrics that are all time-based and not percent based
  readonly addEnhancedMonitoringMaxCpuTotalTimeAlarm?: Record<
    string,
    DurationThreshold
  >;
  readonly addEnhancedMonitoringP90CpuTotalTimeAlarm?: Record<
    string,
    DurationThreshold
  >;
  readonly addEnhancedMonitoringAvgCpuTotalTimeAlarm?: Record<
    string,
    DurationThreshold
  >;

  // Enhanced memory metrics that are percent-based
  readonly addEnhancedMonitoringMaxMemoryUtilizationAlarm?: Record<
    string,
    UsageThreshold
  >;
  readonly addEnhancedMonitoringP90MemoryUtilizationAlarm?: Record<
    string,
    UsageThreshold
  >;
  readonly addEnhancedMonitoringAvgMemoryUtilizationAlarm?: Record<
    string,
    UsageThreshold
  >;

  // Enhanced init duration metrics that are time-based
  readonly addEnhancedMonitoringMaxInitDurationAlarm?: Record<
    string,
    DurationThreshold
  >;
  readonly addEnhancedMonitoringP90InitDurationAlarm?: Record<
    string,
    DurationThreshold
  >;
  readonly addEnhancedMonitoringAvgInitDurationAlarm?: Record<
    string,
    DurationThreshold
  >;
}

export interface LambdaFunctionMonitoringProps
  extends LambdaFunctionMetricFactoryProps,
    LambdaFunctionMonitoringOptions {}

export class LambdaFunctionMonitoring extends Monitoring {
  readonly title: string;
  readonly functionUrl?: string;

  readonly namingStrategy: MonitoringNamingStrategy;
  readonly metricFactory: LambdaFunctionMetricFactory;
  readonly alarmFactory: AlarmFactory;
  readonly errorAlarmFactory: ErrorAlarmFactory;
  readonly latencyAlarmFactory: LatencyAlarmFactory;
  readonly tpsAlarmFactory: TpsAlarmFactory;
  readonly taskHealthAlarmFactory: TaskHealthAlarmFactory;
  readonly ageAlarmFactory: AgeAlarmFactory;
  readonly usageAlarmFactory: UsageAlarmFactory;

  readonly latencyAnnotations: HorizontalAnnotation[];
  readonly errorCountAnnotations: HorizontalAnnotation[];
  readonly errorRateAnnotations: HorizontalAnnotation[];
  readonly invocationCountAnnotations: HorizontalAnnotation[];
  readonly invocationRateAnnotations: HorizontalAnnotation[];
  readonly tpsAnnotations: HorizontalAnnotation[];
  readonly cpuTotalTimeAnnotations: HorizontalAnnotation[];
  readonly memoryUsageAnnotations: HorizontalAnnotation[];
  readonly maxIteratorAgeAnnotations: HorizontalAnnotation[];
  readonly maxOffsetLagAnnotations: HorizontalAnnotation[];
  readonly initDurationAnnotations: HorizontalAnnotation[];

  readonly tpsMetric: MetricWithAlarmSupport;
  readonly p50LatencyMetric: MetricWithAlarmSupport;
  readonly p90LatencyMetric: MetricWithAlarmSupport;
  readonly p99LatencyMetric: MetricWithAlarmSupport;
  readonly maxLatencyMetric: MetricWithAlarmSupport;
  readonly faultCountMetric: MetricWithAlarmSupport;
  readonly faultRateMetric: MetricWithAlarmSupport;
  readonly invocationCountMetric: MetricWithAlarmSupport;
  readonly throttlesCountMetric: MetricWithAlarmSupport;
  readonly throttlesRateMetric: MetricWithAlarmSupport;
  readonly concurrentExecutionsCountMetric: MetricWithAlarmSupport;
  readonly provisionedConcurrencySpilloverInvocationsCountMetric: MetricWithAlarmSupport;
  readonly provisionedConcurrencySpilloverInvocationsRateMetric: MetricWithAlarmSupport;

  readonly isIterator: boolean;
  readonly maxIteratorAgeMetric: MetricWithAlarmSupport;
  readonly isOffsetLag: boolean;
  readonly maxOffsetLagMetric: MetricWithAlarmSupport;

  readonly lambdaInsightsEnabled: boolean;
  readonly enhancedMetricFactory?: LambdaFunctionEnhancedMetricFactory;
  readonly enhancedMonitoringMaxCpuTotalTimeMetric?: MetricWithAlarmSupport;
  readonly enhancedMonitoringP90CpuTotalTimeMetric?: MetricWithAlarmSupport;
  readonly enhancedMonitoringAvgCpuTotalTimeMetric?: MetricWithAlarmSupport;
  readonly enhancedMonitoringMaxMemoryUtilizationMetric?: MetricWithAlarmSupport;
  readonly enhancedMonitoringP90MemoryUtilizationMetric?: MetricWithAlarmSupport;
  readonly enhancedMonitoringAvgMemoryUtilizationMetric?: MetricWithAlarmSupport;
  readonly enhancedMonitoringMaxInitDurationMetric?: MetricWithAlarmSupport;
  readonly enhancedMonitoringP90InitDurationMetric?: MetricWithAlarmSupport;
  readonly enhancedMonitoringAvgInitDurationMetric?: MetricWithAlarmSupport;
  readonly enhancedMetricFunctionCostMetric?: MetricWithAlarmSupport;

  constructor(scope: MonitoringScope, props: LambdaFunctionMonitoringProps) {
    super(scope, props);

    this.namingStrategy = new MonitoringNamingStrategy({
      ...props,
      namedConstruct: props.lambdaFunction,
      fallbackConstructName: this.resolveFunctionName(props.lambdaFunction),
    });

    this.title = this.namingStrategy.resolveHumanReadableName();
    this.functionUrl = scope
      .createAwsConsoleUrlFactory()
      .getLambdaFunctionUrl(props.lambdaFunction.functionName);

    this.alarmFactory = this.createAlarmFactory(
      this.namingStrategy.resolveAlarmFriendlyName(),
    );
    this.errorAlarmFactory = new ErrorAlarmFactory(this.alarmFactory);
    this.latencyAlarmFactory = new LatencyAlarmFactory(this.alarmFactory);
    this.tpsAlarmFactory = new TpsAlarmFactory(this.alarmFactory);
    this.taskHealthAlarmFactory = new TaskHealthAlarmFactory(this.alarmFactory);
    this.ageAlarmFactory = new AgeAlarmFactory(this.alarmFactory);
    this.usageAlarmFactory = new UsageAlarmFactory(this.alarmFactory);

    this.latencyAnnotations = [];
    this.errorCountAnnotations = [];
    this.errorRateAnnotations = [];
    this.invocationCountAnnotations = [];
    this.invocationRateAnnotations = [];
    this.tpsAnnotations = [];
    this.cpuTotalTimeAnnotations = [];
    this.memoryUsageAnnotations = [];
    this.maxIteratorAgeAnnotations = [];
    this.maxOffsetLagAnnotations = [];
    this.initDurationAnnotations = [];

    this.metricFactory = new LambdaFunctionMetricFactory(
      scope.createMetricFactory(),
      props,
    );
    this.tpsMetric = this.metricFactory.metricInvocationRate(
      RateComputationMethod.PER_SECOND,
    );
    this.p50LatencyMetric = this.metricFactory.metricLatencyInMillis(
      LatencyType.P50,
    );
    this.p90LatencyMetric = this.metricFactory.metricLatencyInMillis(
      LatencyType.P90,
    );
    this.p99LatencyMetric = this.metricFactory.metricLatencyInMillis(
      LatencyType.P99,
    );
    this.maxLatencyMetric = this.metricFactory.metricLatencyInMillis(
      LatencyType.MAX,
    );
    this.faultCountMetric = this.metricFactory.metricFaultCount();
    this.faultRateMetric = this.metricFactory.metricFaultRate();
    this.invocationCountMetric = this.metricFactory.metricInvocationCount();
    this.throttlesCountMetric = this.metricFactory.metricThrottlesCount();
    this.throttlesRateMetric = this.metricFactory.metricThrottlesRate();
    this.concurrentExecutionsCountMetric =
      this.metricFactory.metricConcurrentExecutions();
    this.provisionedConcurrencySpilloverInvocationsCountMetric =
      this.metricFactory.metricProvisionedConcurrencySpilloverInvocations();
    this.provisionedConcurrencySpilloverInvocationsRateMetric =
      this.metricFactory.metricProvisionedConcurrencySpilloverRate();

    this.isIterator = props.isIterator ?? true;
    this.maxIteratorAgeMetric =
      this.metricFactory.metricMaxIteratorAgeInMillis();
    this.isOffsetLag = props.isOffsetLag ?? false;
    this.maxOffsetLagMetric =
      this.metricFactory.metricMaxOffsetLagInNumberOfRecords();

    this.lambdaInsightsEnabled = props.lambdaInsightsEnabled ?? false;
    if (props.lambdaInsightsEnabled) {
      this.enhancedMetricFactory = new LambdaFunctionEnhancedMetricFactory(
        scope.createMetricFactory(),
        props,
      );
      this.enhancedMonitoringMaxCpuTotalTimeMetric =
        this.enhancedMetricFactory.enhancedMetricMaxCpuTotalTime();
      this.enhancedMonitoringP90CpuTotalTimeMetric =
        this.enhancedMetricFactory.enhancedMetricP90CpuTotalTime();
      this.enhancedMonitoringAvgCpuTotalTimeMetric =
        this.enhancedMetricFactory.enhancedMetricAvgCpuTotalTime();
      this.enhancedMonitoringMaxMemoryUtilizationMetric =
        this.enhancedMetricFactory.enhancedMetricMaxMemoryUtilization();
      this.enhancedMonitoringP90MemoryUtilizationMetric =
        this.enhancedMetricFactory.enhancedMetricP90MemoryUtilization();
      this.enhancedMonitoringAvgMemoryUtilizationMetric =
        this.enhancedMetricFactory.enhancedMetricAvgMemoryUtilization();
      this.enhancedMonitoringMaxInitDurationMetric =
        this.enhancedMetricFactory.enhancedMetricMaxInitDuration();
      this.enhancedMonitoringP90InitDurationMetric =
        this.enhancedMetricFactory.enhancedMetricP90InitDuration();
      this.enhancedMonitoringAvgInitDurationMetric =
        this.enhancedMetricFactory.enhancedMetricAvgInitDuration();
      this.enhancedMetricFunctionCostMetric =
        this.enhancedMetricFactory.enhancedMetricFunctionCost();

      for (const disambiguator in props.addEnhancedMonitoringMaxCpuTotalTimeAlarm) {
        const alarmProps =
          props.addEnhancedMonitoringMaxCpuTotalTimeAlarm[disambiguator];
        const createdAlarm = this.latencyAlarmFactory.addDurationAlarm(
          /* eslint-disable @typescript-eslint/no-non-null-assertion */
          this.enhancedMonitoringMaxCpuTotalTimeMetric!,
          /* eslint-enable @typescript-eslint/no-non-null-assertion */
          LatencyType.P100,
          alarmProps,
          disambiguator,
        );
        this.cpuTotalTimeAnnotations.push(createdAlarm.annotation);
        this.addAlarm(createdAlarm);
      }
      for (const disambiguator in props.addEnhancedMonitoringP90CpuTotalTimeAlarm) {
        const alarmProps =
          props.addEnhancedMonitoringP90CpuTotalTimeAlarm[disambiguator];
        const createdAlarm = this.latencyAlarmFactory.addDurationAlarm(
          /* eslint-disable @typescript-eslint/no-non-null-assertion */
          this.enhancedMonitoringP90CpuTotalTimeMetric!,
          /* eslint-enable @typescript-eslint/no-non-null-assertion */
          LatencyType.P90,
          alarmProps,
          disambiguator,
        );
        this.cpuTotalTimeAnnotations.push(createdAlarm.annotation);
        this.addAlarm(createdAlarm);
      }
      for (const disambiguator in props.addEnhancedMonitoringAvgCpuTotalTimeAlarm) {
        const alarmProps =
          props.addEnhancedMonitoringAvgCpuTotalTimeAlarm[disambiguator];
        const createdAlarm = this.latencyAlarmFactory.addDurationAlarm(
          /* eslint-disable @typescript-eslint/no-non-null-assertion */
          this.enhancedMonitoringAvgCpuTotalTimeMetric!,
          /* eslint-enable @typescript-eslint/no-non-null-assertion */
          LatencyType.AVERAGE,
          alarmProps,
          disambiguator,
        );
        this.cpuTotalTimeAnnotations.push(createdAlarm.annotation);
        this.addAlarm(createdAlarm);
      }
      for (const disambiguator in props.addEnhancedMonitoringMaxMemoryUtilizationAlarm) {
        const alarmProps =
          props.addEnhancedMonitoringMaxMemoryUtilizationAlarm[disambiguator];
        const createdAlarm =
          this.usageAlarmFactory.addMaxMemoryUsagePercentAlarm(
            /* eslint-disable @typescript-eslint/no-non-null-assertion */
            this.enhancedMonitoringMaxMemoryUtilizationMetric!,
            /* eslint-enable @typescript-eslint/no-non-null-assertion */
            alarmProps,
            disambiguator,
          );
        this.memoryUsageAnnotations.push(createdAlarm.annotation);
        this.addAlarm(createdAlarm);
      }
      for (const disambiguator in props.addEnhancedMonitoringP90MemoryUtilizationAlarm) {
        const alarmProps =
          props.addEnhancedMonitoringP90MemoryUtilizationAlarm[disambiguator];
        const createdAlarm = this.usageAlarmFactory.addMemoryUsagePercentAlarm(
          /* eslint-disable @typescript-eslint/no-non-null-assertion */
          this.enhancedMonitoringP90MemoryUtilizationMetric!,
          /* eslint-enable @typescript-eslint/no-non-null-assertion */
          alarmProps,
          UsageType.P90,
          disambiguator,
        );
        this.memoryUsageAnnotations.push(createdAlarm.annotation);
        this.addAlarm(createdAlarm);
      }
      for (const disambiguator in props.addEnhancedMonitoringAvgMemoryUtilizationAlarm) {
        const alarmProps =
          props.addEnhancedMonitoringAvgMemoryUtilizationAlarm[disambiguator];
        const createdAlarm = this.usageAlarmFactory.addMemoryUsagePercentAlarm(
          /* eslint-disable @typescript-eslint/no-non-null-assertion */
          this.enhancedMonitoringAvgMemoryUtilizationMetric!,
          /* eslint-enable @typescript-eslint/no-non-null-assertion */
          alarmProps,
          UsageType.AVERAGE,
          disambiguator,
        );
        this.memoryUsageAnnotations.push(createdAlarm.annotation);
        this.addAlarm(createdAlarm);
      }
      for (const disambiguator in props.addEnhancedMonitoringMaxInitDurationAlarm) {
        const alarmProps =
          props.addEnhancedMonitoringMaxInitDurationAlarm[disambiguator];
        const createdAlarm = this.latencyAlarmFactory.addCustomDurationAlarm(
          /* eslint-disable @typescript-eslint/no-non-null-assertion */
          this.enhancedMonitoringMaxInitDurationMetric!,
          /* eslint-enable @typescript-eslint/no-non-null-assertion */
          LatencyType.MAX,
          alarmProps,
          "InitDuration",
          disambiguator,
        );
        this.initDurationAnnotations.push(createdAlarm.annotation);
        this.addAlarm(createdAlarm);
      }
      for (const disambiguator in props.addEnhancedMonitoringP90InitDurationAlarm) {
        const alarmProps =
          props.addEnhancedMonitoringP90InitDurationAlarm[disambiguator];
        const createdAlarm = this.latencyAlarmFactory.addCustomDurationAlarm(
          /* eslint-disable @typescript-eslint/no-non-null-assertion */
          this.enhancedMonitoringP90InitDurationMetric!,
          /* eslint-enable @typescript-eslint/no-non-null-assertion */
          LatencyType.P90,
          alarmProps,
          "InitDuration",
          disambiguator,
        );
        this.initDurationAnnotations.push(createdAlarm.annotation);
        this.addAlarm(createdAlarm);
      }
      for (const disambiguator in props.addEnhancedMonitoringAvgInitDurationAlarm) {
        const alarmProps =
          props.addEnhancedMonitoringAvgInitDurationAlarm[disambiguator];
        const createdAlarm = this.latencyAlarmFactory.addCustomDurationAlarm(
          /* eslint-disable @typescript-eslint/no-non-null-assertion */
          this.enhancedMonitoringAvgInitDurationMetric!,
          /* eslint-enable @typescript-eslint/no-non-null-assertion */
          LatencyType.AVERAGE,
          alarmProps,
          "InitDuration",
          disambiguator,
        );
        this.initDurationAnnotations.push(createdAlarm.annotation);
        this.addAlarm(createdAlarm);
      }
    }
    for (const disambiguator in props.addLatencyP50Alarm) {
      const alarmProps = props.addLatencyP50Alarm[disambiguator];
      const createdAlarm = this.latencyAlarmFactory.addLatencyAlarm(
        this.p50LatencyMetric,
        LatencyType.P50,
        this.convertToLatencyThreshold(alarmProps, props.lambdaFunction),
        disambiguator,
      );
      this.latencyAnnotations.push(createdAlarm.annotation);
      this.addAlarm(createdAlarm);
    }
    for (const disambiguator in props.addLatencyP90Alarm) {
      const alarmProps = props.addLatencyP90Alarm[disambiguator];
      const createdAlarm = this.latencyAlarmFactory.addLatencyAlarm(
        this.p90LatencyMetric,
        LatencyType.P90,
        this.convertToLatencyThreshold(alarmProps, props.lambdaFunction),
        disambiguator,
      );
      this.latencyAnnotations.push(createdAlarm.annotation);
      this.addAlarm(createdAlarm);
    }
    for (const disambiguator in props.addLatencyP99Alarm) {
      const alarmProps = props.addLatencyP99Alarm[disambiguator];
      const createdAlarm = this.latencyAlarmFactory.addLatencyAlarm(
        this.p99LatencyMetric,
        LatencyType.P99,
        this.convertToLatencyThreshold(alarmProps, props.lambdaFunction),
        disambiguator,
      );
      this.latencyAnnotations.push(createdAlarm.annotation);
      this.addAlarm(createdAlarm);
    }
    for (const disambiguator in props.addMaxLatencyAlarm) {
      const alarmProps = props.addMaxLatencyAlarm[disambiguator];
      const createdAlarm = this.latencyAlarmFactory.addLatencyAlarm(
        this.maxLatencyMetric,
        LatencyType.MAX,
        this.convertToLatencyThreshold(alarmProps, props.lambdaFunction),
        disambiguator,
      );
      this.latencyAnnotations.push(createdAlarm.annotation);
      this.addAlarm(createdAlarm);
    }

    for (const disambiguator in props.addFaultCountAlarm) {
      const alarmProps = props.addFaultCountAlarm[disambiguator];
      const createdAlarm = this.errorAlarmFactory.addErrorCountAlarm(
        this.faultCountMetric,
        ErrorType.FAULT,
        alarmProps,
        disambiguator,
      );
      this.errorCountAnnotations.push(createdAlarm.annotation);
      this.addAlarm(createdAlarm);
    }
    for (const disambiguator in props.addFaultRateAlarm) {
      const alarmProps = props.addFaultRateAlarm[disambiguator];
      const createdAlarm = this.errorAlarmFactory.addErrorRateAlarm(
        this.faultRateMetric,
        ErrorType.FAULT,
        alarmProps,
        disambiguator,
      );
      this.errorRateAnnotations.push(createdAlarm.annotation);
      this.addAlarm(createdAlarm);
    }
    for (const disambiguator in props.addLowTpsAlarm) {
      const alarmProps = props.addLowTpsAlarm[disambiguator];
      const createdAlarm = this.tpsAlarmFactory.addMinTpsAlarm(
        this.tpsMetric,
        alarmProps,
        disambiguator,
      );
      this.tpsAnnotations.push(createdAlarm.annotation);
      this.addAlarm(createdAlarm);
    }
    for (const disambiguator in props.addHighTpsAlarm) {
      const alarmProps = props.addHighTpsAlarm[disambiguator];
      const createdAlarm = this.tpsAlarmFactory.addMaxTpsAlarm(
        this.tpsMetric,
        alarmProps,
        disambiguator,
      );
      this.tpsAnnotations.push(createdAlarm.annotation);
      this.addAlarm(createdAlarm);
    }
    for (const disambiguator in props.addThrottlesCountAlarm) {
      const alarmProps = props.addThrottlesCountAlarm[disambiguator];
      const createdAlarm = this.errorAlarmFactory.addErrorCountAlarm(
        this.throttlesCountMetric,
        ErrorType.THROTTLED,
        alarmProps,
        disambiguator,
      );
      this.invocationCountAnnotations.push(createdAlarm.annotation);
      this.addAlarm(createdAlarm);
    }
    for (const disambiguator in props.addThrottlesRateAlarm) {
      const alarmProps = props.addThrottlesRateAlarm[disambiguator];
      const createdAlarm = this.errorAlarmFactory.addErrorRateAlarm(
        this.throttlesRateMetric,
        ErrorType.THROTTLED,
        alarmProps,
        disambiguator,
      );
      this.invocationRateAnnotations.push(createdAlarm.annotation);
      this.addAlarm(createdAlarm);
    }
    for (const disambiguator in props.addMinInvocationsCountAlarm) {
      const alarmProps = props.addMinInvocationsCountAlarm[disambiguator];
      const createdAlarm = this.usageAlarmFactory.addMinUsageCountAlarm(
        this.invocationCountMetric,
        alarmProps,
        disambiguator,
      );
      this.invocationCountAnnotations.push(createdAlarm.annotation);
      this.addAlarm(createdAlarm);
    }
    for (const disambiguator in props.addConcurrentExecutionsCountAlarm) {
      const alarmProps = props.addConcurrentExecutionsCountAlarm[disambiguator];
      const createdAlarm = this.taskHealthAlarmFactory.addRunningTaskCountAlarm(
        this.concurrentExecutionsCountMetric,
        alarmProps,
        disambiguator,
      );
      this.invocationCountAnnotations.push(createdAlarm.annotation);
      this.addAlarm(createdAlarm);
    }
    for (const disambiguator in props.addProvisionedConcurrencySpilloverInvocationsCountAlarm) {
      const alarmProps =
        props.addProvisionedConcurrencySpilloverInvocationsCountAlarm[
          disambiguator
        ];
      const createdAlarm = this.taskHealthAlarmFactory.addRunningTaskCountAlarm(
        this.provisionedConcurrencySpilloverInvocationsCountMetric,
        alarmProps,
        disambiguator,
      );
      this.invocationCountAnnotations.push(createdAlarm.annotation);
      this.addAlarm(createdAlarm);
    }
    for (const disambiguator in props.addProvisionedConcurrencySpilloverInvocationsRateAlarm) {
      const alarmProps =
        props.addProvisionedConcurrencySpilloverInvocationsRateAlarm[
          disambiguator
        ];
      const createdAlarm = this.taskHealthAlarmFactory.addRunningTaskRateAlarm(
        this.provisionedConcurrencySpilloverInvocationsRateMetric,
        alarmProps,
        disambiguator,
      );
      this.invocationRateAnnotations.push(createdAlarm.annotation);
      this.addAlarm(createdAlarm);
    }
    for (const disambiguator in props.addMaxIteratorAgeAlarm) {
      if (!this.isIterator) {
        throw new Error(
          "addMaxIteratorAgeAlarm is not applicable if isIterator is not true",
        );
      }

      const alarmProps = props.addMaxIteratorAgeAlarm[disambiguator];
      const createdAlarm = this.ageAlarmFactory.addIteratorMaxAgeAlarm(
        this.maxIteratorAgeMetric,
        alarmProps,
        disambiguator,
      );
      this.maxIteratorAgeAnnotations.push(createdAlarm.annotation);
      this.addAlarm(createdAlarm);
    }
    for (const disambiguator in props.addMaxOffsetLagAlarm) {
      if (!this.isOffsetLag) {
        throw new Error(
          "addMaxOffsetLagAlarm is not applicable if isOffsetLag is not true",
        );
      }

      const alarmProps = props.addMaxOffsetLagAlarm[disambiguator];
      const createdAlarm = this.ageAlarmFactory.addMaxOffsetLagAlarm(
        this.maxOffsetLagMetric,
        alarmProps,
        disambiguator,
      );
      this.maxOffsetLagAnnotations.push(createdAlarm.annotation);
      this.addAlarm(createdAlarm);
    }

    props.useCreatedAlarms?.consume(this.createdAlarms());
  }

  private convertToLatencyThreshold(
    latencyProps: LatencyThreshold | LatencyTimeoutPercentageThreshold,
    lambdaFunction: IFunction,
  ): LatencyThreshold {
    if ("maxLatency" in latencyProps) {
      return latencyProps;
    }
    const { maxLatencyPercentageOfTimeout, ...rest } = latencyProps;
    const timeout = (lambdaFunction as Function).timeout ?? Duration.seconds(3);
    return {
      ...rest,
      maxLatency: Duration.millis(
        Math.floor(
          (timeout.toMilliseconds() * maxLatencyPercentageOfTimeout) / 100,
        ),
      ),
    };
  }

  summaryWidgets(): IWidget[] {
    return [
      this.createTitleWidget(),
      this.createTpsWidget(ThirdWidth, DefaultSummaryWidgetHeight),
      this.createLatencyWidget(ThirdWidth, DefaultSummaryWidgetHeight),
      this.createErrorRateWidget(ThirdWidth, DefaultSummaryWidgetHeight),
    ];
  }

  widgets(): IWidget[] {
    const widgets = [
      this.createTitleWidget(),
      new Row(
        this.createTpsWidget(QuarterWidth, DefaultGraphWidgetHeight),
        this.createLatencyWidget(QuarterWidth, DefaultGraphWidgetHeight),
        this.createErrorRateWidget(QuarterWidth, DefaultGraphWidgetHeight),
        this.createRateWidget(QuarterWidth, DefaultGraphWidgetHeight),
      ),
    ];

    let secondRowWidgetWidth: number;
    if (this.isIterator && this.isOffsetLag) {
      secondRowWidgetWidth = QuarterWidth;
    } else if (this.isIterator || this.isOffsetLag) {
      secondRowWidgetWidth = ThirdWidth;
    } else {
      secondRowWidgetWidth = HalfWidth;
    }
    const secondRow: Row = new Row(
      this.createInvocationWidget(
        secondRowWidgetWidth,
        DefaultGraphWidgetHeight,
      ),
      this.createErrorCountWidget(
        secondRowWidgetWidth,
        DefaultGraphWidgetHeight,
      ),
    );
    if (this.isIterator) {
      secondRow.addWidget(
        this.createIteratorAgeWidget(
          secondRowWidgetWidth,
          DefaultGraphWidgetHeight,
        ),
      );
    }
    if (this.isOffsetLag) {
      secondRow.addWidget(
        this.createOffsetLagWidget(
          secondRowWidgetWidth,
          DefaultGraphWidgetHeight,
        ),
      );
    }
    widgets.push(secondRow);

    if (this.lambdaInsightsEnabled) {
      widgets.push(
        new Row(
          this.createLambdaInsightsCpuWidget(
            QuarterWidth,
            DefaultGraphWidgetHeight,
          ),
          this.createLambdaInsightsMemoryWidget(
            QuarterWidth,
            DefaultGraphWidgetHeight,
          ),
          this.createLambdaInsightsInitDurationWidget(
            QuarterWidth,
            DefaultGraphWidgetHeight,
          ),
          this.createLambdaInsightsFunctionCostWidget(
            QuarterWidth,
            DefaultGraphWidgetHeight,
          ),
        ),
      );
    }

    return widgets;
  }

  createTitleWidget() {
    return new MonitoringHeaderWidget({
      family: "Lambda Function",
      title: this.title,
      goToLinkUrl: this.functionUrl,
    });
  }

  createTpsWidget(width: number, height: number) {
    return new GraphWidget({
      width,
      height,
      title: "TPS",
      left: [this.tpsMetric],
      leftYAxis: RateAxisFromZero,
      leftAnnotations: this.tpsAnnotations,
    });
  }

  createLatencyWidget(width: number, height: number) {
    return new GraphWidget({
      width,
      height,
      title: "Latency",
      left: [
        this.p50LatencyMetric,
        this.p90LatencyMetric,
        this.p99LatencyMetric,
      ],
      leftYAxis: TimeAxisMillisFromZero,
      leftAnnotations: this.latencyAnnotations,
    });
  }

  createErrorCountWidget(width: number, height: number) {
    return new GraphWidget({
      width,
      height,
      title: "Errors",
      left: [this.faultCountMetric],
      leftYAxis: CountAxisFromZero,
      leftAnnotations: this.errorCountAnnotations,
    });
  }

  createErrorRateWidget(width: number, height: number) {
    return new GraphWidget({
      width,
      height,
      title: "Errors (rate)",
      left: [this.faultRateMetric],
      leftYAxis: RateAxisFromZero,
      leftAnnotations: this.errorRateAnnotations,
    });
  }

  createRateWidget(width: number, height: number) {
    return new GraphWidget({
      width,
      height,
      title: "Rates",
      left: [
        this.throttlesRateMetric,
        this.provisionedConcurrencySpilloverInvocationsRateMetric,
      ],
      leftYAxis: RateAxisFromZero,
      leftAnnotations: this.invocationRateAnnotations,
    });
  }

  createInvocationWidget(width: number, height: number) {
    return new GraphWidget({
      width,
      height,
      title: "Invocations",
      left: [
        this.invocationCountMetric,
        this.throttlesCountMetric,
        this.concurrentExecutionsCountMetric,
        this.provisionedConcurrencySpilloverInvocationsCountMetric,
      ],
      leftYAxis: CountAxisFromZero,
      leftAnnotations: this.invocationCountAnnotations,
    });
  }

  createIteratorAgeWidget(width: number, height: number) {
    return new GraphWidget({
      width,
      height,
      title: "Iterator",
      left: [this.maxIteratorAgeMetric],
      leftYAxis: TimeAxisMillisFromZero,
      leftAnnotations: this.maxIteratorAgeAnnotations,
    });
  }

  createOffsetLagWidget(width: number, height: number) {
    return new GraphWidget({
      width,
      height,
      title: "OffsetLag",
      left: [this.maxOffsetLagMetric],
      leftYAxis: CountAxisFromZero,
      leftAnnotations: this.maxOffsetLagAnnotations,
    });
  }

  createLambdaInsightsCpuWidget(width: number, height: number) {
    return new GraphWidget({
      width,
      height,
      title: "CPU Total Time",
      left: [
        /* eslint-disable @typescript-eslint/no-non-null-assertion */
        this.enhancedMonitoringMaxCpuTotalTimeMetric!,
        this.enhancedMonitoringP90CpuTotalTimeMetric!,
        this.enhancedMonitoringAvgCpuTotalTimeMetric!,
        /* eslint-enable @typescript-eslint/no-non-null-assertion */
      ],
      leftYAxis: TimeAxisMillisFromZero,
      leftAnnotations: this.cpuTotalTimeAnnotations,
    });
  }

  createLambdaInsightsMemoryWidget(width: number, height: number) {
    return new GraphWidget({
      width,
      height,
      title: "Memory Utilization",
      left: [
        /* eslint-disable @typescript-eslint/no-non-null-assertion */
        this.enhancedMonitoringMaxMemoryUtilizationMetric!,
        this.enhancedMonitoringP90MemoryUtilizationMetric!,
        this.enhancedMonitoringAvgMemoryUtilizationMetric!,
        /* eslint-enable @typescript-eslint/no-non-null-assertion */
      ],
      leftYAxis: PercentageAxisFromZeroToHundred,
      leftAnnotations: this.memoryUsageAnnotations,
    });
  }

  createLambdaInsightsInitDurationWidget(width: number, height: number) {
    return new GraphWidget({
      width,
      height,
      title: "Init Duration",
      left: [
        /* eslint-disable @typescript-eslint/no-non-null-assertion */
        this.enhancedMonitoringMaxInitDurationMetric!,
        this.enhancedMonitoringP90InitDurationMetric!,
        this.enhancedMonitoringAvgInitDurationMetric!,
        /* eslint-enable @typescript-eslint/no-non-null-assertion */
      ],
      leftYAxis: TimeAxisMillisFromZero,
      leftAnnotations: this.initDurationAnnotations,
    });
  }

  createLambdaInsightsFunctionCostWidget(width: number, height: number) {
    return new GraphWidget({
      width,
      height,
      title: "Function Cost",
      /* eslint-disable @typescript-eslint/no-non-null-assertion */
      left: [this.enhancedMetricFunctionCostMetric!],
      /* eslint-enable @typescript-eslint/no-non-null-assertion */
      leftYAxis: MegabyteMillisecondAxisFromZero,
    });
  }

  private resolveFunctionName(lambdaFunction: IFunction): string | undefined {
    // try to take the name (if specified) instead of token
    return (lambdaFunction.node.defaultChild as CfnFunction)?.functionName;
  }
}
