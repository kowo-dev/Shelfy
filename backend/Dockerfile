FROM eclipse-temurin:25-jdk AS build
WORKDIR /backend

COPY mvnw .
COPY .mvn .mvn
COPY pom.xml .
RUN ./mvnw dependency:go-offline -B

COPY src src
ARG APP_VERSION=dev
RUN ./mvnw package -DskipTests -B -Drevision="$APP_VERSION"

FROM eclipse-temurin:25-jre
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --system --create-home --shell /usr/sbin/nologin shelfy
RUN mkdir -p /data/avatars && chown -R shelfy:shelfy /data/avatars
COPY --from=build /backend/target/api-*.jar app.jar
RUN chown shelfy:shelfy app.jar
USER shelfy

ENV JAVA_OPTS="-XX:MaxRAMPercentage=75.0 -XX:InitialRAMPercentage=50.0"

EXPOSE 8082
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=5 \
    CMD curl -f http://localhost:8082/actuator/health || exit 1
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
