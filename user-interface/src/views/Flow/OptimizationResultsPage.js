import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useParams, useHistory } from "react-router-dom";
import {
  Box,
  Flex,
  Grid,
  IconButton,
  Divider,
  Text,
  Spinner,
  HStack,
} from "@chakra-ui/react";
import Card from "components/Card/Card";
import CardBody from "components/Card/CardBody";
import CardHeader from "components/Card/CardHeader";
import Chart from "react-apexcharts";
import {
  ArrowBackIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@chakra-ui/icons";
import { FiDownload } from "react-icons/fi";
import {
  fetchSearchResult,
  fetchOptimizationData,
} from "store/features/flowSlice";
import { getColor } from "@chakra-ui/theme-tools";

const OptimizationResultsPage = () => {
  const { projectId, flowId } = useParams();
  const dispatch = useDispatch();
  const history = useHistory();

  // Flow 및 기타 기본 데이터
  const flow = useSelector((state) => state.flows.flows[flowId] || {});
  // searchResult: 최적화 결과 (API 응답에서 search_result 배열)
  const searchResult = useSelector((state) => state.flows.searchResult[flowId]);
  // optimizationData: 각 property의 최적화 목표, 타입, 순서 등 (redux에 저장됨)
  const optimizationData = useSelector(
    (state) => state.flows.optimizationData[flowId] || {}
  );

  const [loading, setLoading] = useState(true);

  const getGoalColor = (goal) => {
    switch (goal) {
      case "No Optimization":
        return "gray.100";
      case "Maximize":
        return "green.100";
      case "Minimize":
        return "red.100";
      case "Fit to Range":
        return "orange.100";
      case "Fit to Property":
        return "purple.100";
      default:
        return "gray.100";
    }
  };

  // 페이징 관련 state: 2x2 그리드를 사용하므로 한 페이지에 4개 카드
  const pageSize = 4;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = searchResult
    ? Math.ceil(searchResult.length / pageSize)
    : 0;
  const currentResults = searchResult
    ? searchResult.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : [];

  // 페이지 마운트 시 searchResult fetch
  useEffect(() => {
    if (!flowId) return;
    dispatch(fetchSearchResult(flowId))
      .unwrap()
      .catch((err) => console.error("Error fetching search result:", err))
      .finally(() => setLoading(false));
  }, [dispatch, flowId]);

  // optimizationData fetch:
  // API 요청을 현재 페이지의 결과(currentResults)에서만 진행하고,
  // 이미 데이터가 있는 property는 건너뛰도록 처리
  useEffect(() => {
    if (currentResults && currentResults.length > 0) {
      currentResults.forEach((item) => {
        const { column_name, property_type } = item;
        // controllable/output 속성이고, 아직 redux에 데이터가 없다면 API 요청
        if (
          (property_type === "controllable" || property_type === "output") &&
          !optimizationData[column_name]
        ) {
          dispatch(
            fetchOptimizationData({
              flowId,
              property: column_name,
              type: property_type,
            })
          );
        }
      });
    }
  }, [dispatch, flowId, currentResults, optimizationData]);

  // 기본 차트 옵션 (Area 차트, 채움 효과 포함, 제목 제거)
  const baseChartOptions = useMemo(() => {
    return {
      chart: {
        type: "line",
        zoom: { enabled: false },
        toolbar: { show: false },
      },
      dataLabels: { enabled: false },
      stroke: { curve: "smooth", width: 3 },
      xaxis: {
        labels: { show: false },
        axisTicks: { show: false },
        axisBorder: { show: false },
      },
      yaxis: {
        labels: {
          formatter: (val) => val?.toFixed(3),
          style: {
            colors: "#fff",
            fontSize: "10px",
          },
        },
      },
      tooltip: {
        shared: true,
        intersect: false,
        theme: "dark",
        style: {
          fontSize: "12px",
        },
      },
      legend: { labels: { colors: "#fff" } },
      colors: ["#2CD9FF", "#582CFF"],

      grid: {
        show: false,
        padding: {
          left: 20,
        },
      },
    };
  }, []);

  const sortedCurrentResults = useMemo(() => {
    if (!currentResults) return [];
    return currentResults.slice().sort((a, b) => {
      // 각 항목의 우선순위는 optimizationData에서 가져온 order 값 (없으면 0으로 처리)
      const aPriority = optimizationData[a.column_name]?.order || 0;
      const bPriority = optimizationData[b.column_name]?.order || 0;
      // 내림차순: 우선순위가 높은(값이 큰) 항목이 먼저 오도록
      return aPriority - bPriority;
    });
  }, [currentResults, optimizationData]);

  // 각 결과 카드 렌더링 함수
  const renderResultCard = (item, index) => {
    const property = item.column_name;
    const optData = optimizationData[property] || null;
    const isNumeric = item.column_type === "numerical";
    const series = isNumeric
      ? [
          { name: "Previous", data: item.ground_truth },
          { name: "Optimized", data: item.predicted },
        ]
      : [];

    const avgChangeRate = item.average_change_rate;

    // 기존 차트 옵션(baseChartOptions)과 어노테이션 구성은 그대로 사용한다고 가정
    const options = { ...baseChartOptions };
    const rangeAnnotations =
      optData && optData.minimum_value !== "" && optData.maximum_value !== ""
        ? {
            yaxis: [
              {
                y: optData.minimum_value,
                borderColor: "rgba(0,227,150,0.9)",
                borderWidth: 3,
                label: {
                  style: {
                    color: "#fff",
                    background: "rgba(0,227,150,0.9)",
                    fontFamily: "Plus Jakarta Display",
                    fontSize: "8px",
                  },
                },
              },
              {
                y: optData.maximum_value,
                borderColor: "rgba(255,69,96,0.9)",
                borderWidth: 3,
                label: {
                  style: {
                    color: "#fff",
                    background: "rgba(255,69,96,0.9)",
                    fontFamily: "Plus Jakarta Display",
                    fontSize: "8px",
                  },
                },
              },
            ],
          }
        : {};
    const optionsWithAnnotations = {
      ...options,
      annotations: rangeAnnotations,
    };

    return (
      <Card key={index} h="300px">
        <CardHeader pb={2}>
          <Flex justify="space-between" align="center" w="100%">
            <Box>
              <Text fontSize="lg" fontWeight="bold">
                {property}
              </Text>
              <Flex justify="space-between" w="100%">
                <Text fontSize="sm" color="gray.400" flex="1">
                  Type: {item.column_type || "-"} | Priority:{" "}
                  {optData ? optData.order || "-" : "-"}
                </Text>
                {/* average_change_rate는 숫자형(numerical)인 경우에만 렌더링 */}
                {isNumeric &&
                  typeof avgChangeRate === "number" &&
                  (!optData ||
                    (optData.goal !== "Fit to Property" &&
                      optData.goal !== "Fit to Range")) && (
                    <Text
                      fontSize="sm"
                      color={avgChangeRate >= 0 ? "green.500" : "red.500"}
                      flexShrink={0}
                      ml={4}
                    >
                      {avgChangeRate >= 0
                        ? `Increased by ${avgChangeRate.toFixed(2)}%`
                        : `Decreased by ${Math.abs(avgChangeRate).toFixed(2)}%`}
                    </Text>
                  )}
              </Flex>
            </Box>
            <Card
              bg="transparent"
              borderRadius="md"
              p={2}
              boxShadow="sm"
              w="140px"
            >
              <Text
                fontSize="sm"
                color={optData ? getGoalColor(optData.goal) : "gray.400"}
                textAlign="center"
              >
                {optData ? optData.goal || "-" : "Loading..."}
              </Text>
            </Card>
          </Flex>
        </CardHeader>
        <Divider borderColor="gray.600" />
        <CardBody p={2} h="100%">
          <Box w="100%">
            {isNumeric ? (
              optData ? (
                <Chart
                  options={optionsWithAnnotations}
                  series={series}
                  type="line"
                  width="100%"
                  height="100%"
                />
              ) : (
                <Flex justify="center" align="center" h="100%">
                  <Spinner size="md" />
                </Flex>
              )
            ) : (
              <Flex justify="center" align="center" h="100%">
                <Text color="gray.400">No chart available for this type.</Text>
              </Flex>
            )}
          </Box>
        </CardBody>
      </Card>
    );
  };

  // 페이징 핸들러
  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage((prev) => prev - 1);
  };
  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage((prev) => prev + 1);
  };

  if (!flow) {
    return (
      <Flex pt={{ base: "120px", md: "75px" }} justify="center">
        <Text color="red.500">Flow not found</Text>
      </Flex>
    );
  }
  if (loading) {
    return (
      <Flex pt={{ base: "120px", md: "75px" }} justify="center">
        <Spinner size="xl" />
      </Flex>
    );
  }

  return (
    <Flex
      flexDirection="column"
      pt={{ base: "120px", md: "75px" }}
      px={6}
      color="white"
      maxH="100vh"
    >
      {/* 헤더 영역 */}
      <Flex justifyContent="space-between" alignItems="center" mb={3} px={6}>
        <IconButton
          icon={<ArrowBackIcon />}
          onClick={() => history.goBack()}
          colorScheme="blue"
        />
        <Box textAlign="center">
          <Text fontSize="2xl" fontWeight="bold">
            Optimization Results
          </Text>
          <Text fontSize="md" color="gray.400">
            Explore optimization outcomes by property.
          </Text>
        </Box>
        <IconButton
          icon={<FiDownload color="#fff" />}
          onClick={() =>
            history.push(`/projects/${projectId}/flows/${flowId}/download`)
          }
          colorScheme="teal"
        />
      </Flex>

      {/* 결과 카드 영역 - 2x2 그리드 */}
      <Grid templateColumns="repeat(2, 1fr)" gap={4} h="calc(80vh - 130px)">
        {sortedCurrentResults && sortedCurrentResults.length > 0 ? (
          sortedCurrentResults.map((item, index) =>
            renderResultCard(item, index)
          )
        ) : (
          <Text color="white" textAlign="center" width="100%">
            No optimization results available.
          </Text>
        )}
      </Grid>

      {/* 페이징 컨트롤 */}
      {totalPages > 1 && (
        <Flex justifyContent="center" alignItems="center" mt={4}>
          <HStack spacing={4}>
            <IconButton
              aria-label="Previous Page"
              icon={<ChevronLeftIcon />}
              onClick={handlePrevPage}
              colorScheme="whiteAlpha"
              isDisabled={currentPage === 1}
            />
            <Text color="white">
              Page {currentPage} of {totalPages}
            </Text>
            <IconButton
              aria-label="Next Page"
              icon={<ChevronRightIcon />}
              onClick={handleNextPage}
              colorScheme="whiteAlpha"
              isDisabled={currentPage === totalPages}
            />
          </HStack>
        </Flex>
      )}
    </Flex>
  );
};

export default OptimizationResultsPage;
