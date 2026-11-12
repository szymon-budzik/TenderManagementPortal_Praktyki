# Etap 1: Budowanie paczki JAR za pomocą Mavena
FROM maven:3.9.6-eclipse-temurin-21-alpine AS builder
WORKDIR /app

# Kopiowanie deskryptora i pobranie zależności (cache warstw Dockera)
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Kopiowanie źródeł i kompilacja
COPY src ./src
RUN mvn clean package -DskipTests

# Etap 2: Lekki obraz uruchomieniowy JRE
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Kopiowanie gotowego pliku JAR z etapu budowania
COPY --from=builder /app/target/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]