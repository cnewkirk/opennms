package org.opennms.web.rest.v2;

import org.opennms.util.ilr.ServiceCollector;

public class ServiceCollectorDTO {
    public String serviceId;
    public String parsedServiceId;
    public int collectionCount;
    public int successfulCollectionCount;
    public int errorCollectionCount;
    public double successPercentage;
    public double errorPercentage;
    public long avgCollectionTimeMs;
    public long avgTimeBetweenCollectionsMs;
    public long avgErrorCollectionTimeMs;
    public long avgPersistTimeMs;
    public long totalPersistTimeMs;

    public static ServiceCollectorDTO from(ServiceCollector sc) {
        ServiceCollectorDTO dto = new ServiceCollectorDTO();
        dto.serviceId = sc.getServiceID();
        dto.parsedServiceId = sc.getParsedServiceID();
        dto.collectionCount = sc.getCollectionCount();
        dto.successfulCollectionCount = sc.getSuccessfulCollectionCount();
        dto.errorCollectionCount = sc.getErrorCollectionCount();
        dto.successPercentage = sc.getSuccessPercentage();
        dto.errorPercentage = sc.getErrorPercentage();
        dto.avgCollectionTimeMs = sc.getAverageCollectionTime();
        dto.avgTimeBetweenCollectionsMs = sc.getAverageTimeBetweenCollections();
        dto.avgErrorCollectionTimeMs = sc.getAverageErrorCollectionTime();
        dto.avgPersistTimeMs = sc.getAveragePersistTime();
        dto.totalPersistTimeMs = sc.getTotalPersistTime();
        return dto;
    }
}
