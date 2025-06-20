import { db } from '../server/db.js';
import { places, accessibilityReports } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

// Direct JSON data from the attached files - Batch 6
const poiReports = [
  {
    "kakao_mapping": {
      "place_id": "892498928",
      "place_name": "GS25 신촌명물길점",
      "coordinates": {
        "lat": 37.5588353689462,
        "lng": 126.939671117926
      }
    },
    "accessibility_info": {
      "accessibility_score": 8
    },
    "llm_analysis": {
      "final_accessibility_score": 9,
      "access_recommendation": "assisted",
      "stairs_count": 2,
      "stairs_height": "약 20-30cm (표준 계단 1-2개 높이)",
      "stair_severity_assessment": "경미한 수준의 계단으로 편의점 입구 앞에 1-2개의 낮은 계단이 있습니다. 높이가 낮아 동행인의 도움이 있으면 충분히 접근 가능합니다.",
      "observations": [
        "GS25 편의점으로 24시간 운영 가능성이 높아 접근성 중요",
        "입구가 유리문으로 되어 있어 내부 확인 가능",
        "보도블록이 평탄하게 설치되어 있어 계단 외 경로는 양호",
        "계단 검출 신뢰도가 0.89로 높아 분석 결과 신뢰 가능"
      ],
      "recommendations": {
        "for_independent": [
          "낮은 계단이지만 혼자서는 위험할 수 있으니 가급적 동행인과 함께 방문 권장",
          "휠체어 사용자는 사전에 매장에 연락하여 도움 요청 고려"
        ],
        "for_assisted": [
          "1-2명의 동행인이 있으면 안전하게 접근 가능",
          "계단이 낮아 휠체어를 들어올리는 데 큰 어려움 없음"
        ],
        "facility_improvements": [
          "이동식 경사로 설치로 독립적 접근성 크게 개선 가능",
          "계단 옆 손잡이 설치로 안전성 향상",
          "입구 계단 부분에 시각적 경고 표시 추가"
        ]
      }
    }
  },
  {
    "kakao_mapping": {
      "place_id": "18664453",
      "place_name": "GS25 신촌이화점",
      "coordinates": {
        "lat": 37.5570229756614,
        "lng": 126.941749466856
      }
    },
    "accessibility_info": {
      "accessibility_score": 8
    },
    "llm_analysis": {
      "final_accessibility_score": 9,
      "access_recommendation": "assisted",
      "stairs_count": 2,
      "stairs_height": "약 20-30cm (각 단 10-15cm)",
      "stair_severity_assessment": "경미한 수준의 계단으로 2단 정도이며, 편의점 입구의 일반적인 높이 차이를 보임. 휠체어 사용자가 혼자서는 접근이 어렵지만 동행인 1명의 도움으로는 충분히 극복 가능한 수준",
      "observations": [
        "전형적인 소규모 편의점 입구 구조",
        "계단 검출 신뢰도 0.85로 높은 정확도",
        "입구 너비는 휠체어 진입에 충분",
        "보도와의 연결성 양호",
        "매장 내부는 평탄하게 보임"
      ],
      "recommendations": {
        "for_independent": [
          "휴대용 경사로 지참 시 독립 접근 가능",
          "전동휠체어의 경우 계단 오르기 기능 활용 검토",
          "사전에 매장에 도움 요청 연락"
        ],
        "for_assisted": [
          "동행인 1명이면 충분히 안전하게 접근 가능",
          "계단이 낮아 들어올리기보다는 뒤로 기울여 올리는 방법 권장",
          "입구 통로가 넓어 회전 공간 충분"
        ],
        "facility_improvements": [
          "휴대용 경사로 비치 권장",
          "고정식 경사로 설치 (폭 90cm 이상)",
          "계단 옆 손잡이 설치로 보행 약자도 배려"
        ]
      }
    }
  },
  {
    "kakao_mapping": {
      "place_id": "21159141",
      "place_name": "GS25 신촌파크점",
      "coordinates": {
        "lat": 37.5561574789073,
        "lng": 126.938552510593
      }
    },
    "accessibility_info": {
      "accessibility_score": 8
    },
    "llm_analysis": {
      "final_accessibility_score": 9,
      "access_recommendation": "assisted",
      "stairs_count": 2,
      "stairs_height": "약 30-40cm (각 계단 15-20cm 높이)",
      "stair_severity_assessment": "경미한 수준의 계단으로, 2단의 낮은 계단이 매장 입구 앞에 위치. 계단 너비는 충분하고 안정적인 구조를 보임",
      "observations": [
        "GS25 편의점 입구에 2단의 계단 확인",
        "계단 검출 신뢰도가 0.84로 높아 정확한 분석 가능",
        "보도는 잘 정비되어 있으나 계단이 주요 장애물",
        "매장 입구 너비는 충분해 보임",
        "주변 보도 상태는 양호하여 계단만 극복하면 접근 가능"
      ],
      "recommendations": {
        "for_independent": [
          "휠체어 사용자 혼자서는 2단 계단 극복이 매우 어려움",
          "전동휠체어의 경우에도 계단 극복 불가능",
          "사전에 매장에 연락하여 도움 요청 권장"
        ],
        "for_assisted": [
          "1-2명의 동행인이 있다면 안전하게 접근 가능",
          "계단이 낮아 동행인의 도움으로 비교적 쉽게 극복 가능",
          "매장 직원에게 도움을 요청하는 것도 좋은 방법"
        ],
        "facility_improvements": [
          "휴대용 경사로 설치로 접근성 크게 개선 가능",
          "영구적인 경사로 설치 권장",
          "계단 옆 손잡이 설치로 안전성 향상 필요"
        ]
      }
    }
  },
  {
    "kakao_mapping": {
      "place_id": "12297007",
      "place_name": "GS25 신촌현대점",
      "coordinates": {
        "lat": 37.5582949705995,
        "lng": 126.942417130232
      }
    },
    "accessibility_info": {
      "accessibility_score": 8
    },
    "llm_analysis": {
      "final_accessibility_score": 9,
      "access_recommendation": "assisted",
      "stairs_count": 2,
      "stairs_height": "약 20-30cm (표준 계단 2단 높이)",
      "stair_severity_assessment": "경미한 수준의 계단으로, 편의점 입구에 1-2단의 낮은 계단이 있음. 단차가 크지 않아 동행인의 도움이 있으면 비교적 쉽게 접근 가능",
      "observations": [
        "GS25 편의점 입구에 2단의 낮은 계단 확인",
        "입구 너비는 충분하여 휠체어 통행 가능",
        "보도와 연결되어 있으나 계단이 주요 장애물",
        "매장 내부는 평탄해 보임",
        "검출 신뢰도가 0.81로 높아 계단 존재 확실"
      ],
      "recommendations": {
        "for_independent": [
          "휠체어 사용자 혼자서는 계단으로 인해 접근이 어려움",
          "전동휠체어의 경우 계단 오르기 기능이 없다면 접근 불가",
          "수동휠체어도 2단 계단은 혼자서 극복하기 매우 어려움"
        ],
        "for_assisted": [
          "1-2명의 동행인이 있으면 안전하게 접근 가능",
          "계단이 낮아 휠체어를 들어올리기 비교적 수월함",
          "입구가 넓어 동행인과 함께 이동하기 충분함"
        ],
        "facility_improvements": [
          "휴대용 경사로 설치로 즉시 접근성 개선 가능",
          "영구적 경사로 설치 권장 (2단 정도는 짧은 경사로로 해결 가능)",
          "입구 단차 제거 공사 고려"
        ]
      }
    }
  },
  {
    "kakao_mapping": {
      "place_id": "12297028",
      "place_name": "GS25 연대2점",
      "coordinates": {
        "lat": 37.5585777070086,
        "lng": 126.936452088466
      }
    },
    "accessibility_info": {
      "accessibility_score": 8
    },
    "llm_analysis": {
      "final_accessibility_score": 9,
      "access_recommendation": "assisted",
      "stairs_count": 1,
      "stairs_height": "약 15-20cm 높이의 단차 1개",
      "stair_severity_assessment": "입구에 1단의 낮은 단차가 있으나, 휠체어 사용자가 동행인의 도움을 받으면 쉽게 극복 가능한 수준입니다. 독립적 접근시에는 어려움이 있을 수 있습니다.",
      "observations": [
        "전형적인 소규모 편의점으로 1단의 낮은 단차 존재",
        "입구 문이 유리문으로 폭은 적절해 보임",
        "보도와 연결성은 양호하나 단차가 접근성 제한",
        "매장 규모가 작아 내부 이동 공간도 고려 필요"
      ],
      "recommendations": {
        "for_independent": [
          "휴대용 경사로를 미리 준비하여 방문",
          "점원에게 도움 요청을 위한 호출벨 활용",
          "단차가 낮으므로 전동휠체어의 경우 조심스럽게 시도 가능"
        ],
        "for_assisted": [
          "동행인 1명이면 충분히 도움 가능",
          "입구 단차 통과시 후진으로 진입하는 것이 안전",
          "매장 내부 공간이 협소할 수 있으니 피크시간 피하기"
        ],
        "facility_improvements": [
          "입구 단차 제거 또는 영구 경사로 설치",
          "자동문 설치로 독립적 접근성 향상",
          "입구 앞 공간 확보를 위한 진열대 재배치"
        ]
      }
    }
  },
  {
    "kakao_mapping": {
      "place_id": "1402782800",
      "place_name": "투썸플레이스 신촌연세로점",
      "coordinates": {
        "lat": 37.5580890923682,
        "lng": 126.937117872985
      }
    },
    "accessibility_info": {
      "accessibility_score": 10
    },
    "llm_analysis": {
      "final_accessibility_score": 9,
      "access_recommendation": "independent",
      "stairs_count": 0,
      "stairs_height": "계단 없음 - 평지 접근",
      "stair_severity_assessment": "계단이 감지되지 않았으며, 건물 입구는 보도블록과 같은 높이로 평탄함",
      "observations": [
        "1층 카페로 계단 없이 직접 진입 가능",
        "넓은 유리문과 평탄한 입구 확인",
        "보도블록이 건물 입구까지 연결되어 있음",
        "입구 앞 충분한 공간으로 휠체어 회전 가능"
      ],
      "recommendations": {
        "for_independent": [
          "넓은 유리문으로 휠체어 진입이 용이함",
          "평탄한 보도블록으로 안전한 접근 가능",
          "입구 앞 충분한 회전 공간 확보"
        ],
        "for_assisted": [
          "동행인 없이도 독립적 접근이 가능한 수준",
          "필요시 문 개폐 도움만으로 충분"
        ],
        "facility_improvements": [
          "자동문 설치 시 완벽한 접근성 확보 가능",
          "입구 앞 간판 위치 조정으로 통행로 확대 고려"
        ]
      }
    }
  },
  {
    "kakao_mapping": {
      "place_id": "2025255440",
      "place_name": "페라 본점",
      "coordinates": {
        "lat": 37.5586536023804,
        "lng": 126.945920737962
      }
    },
    "accessibility_info": {
      "accessibility_score": 10
    },
    "llm_analysis": {
      "final_accessibility_score": 9,
      "access_recommendation": "independent",
      "stairs_count": 0,
      "stairs_height": "계단 없음 - 평지 접근",
      "stair_severity_assessment": "계단이 감지되지 않았으며, 입구는 도로면과 같은 높이에 위치",
      "observations": [
        "카페 입구가 도로면과 동일한 높이에 위치",
        "유리문으로 된 주 출입구 확인",
        "보도와 연결성이 양호함",
        "입구 앞 평탄한 지면 확인",
        "건물 검출 신뢰도 100%로 매우 높음"
      ],
      "recommendations": {
        "for_independent": [
          "유리문이 자동문인지 확인 필요",
          "문 앞 회전 공간 확보 여부 확인",
          "실내 진입 후 테이블 간격 확인 권장"
        ],
        "for_assisted": [
          "동행인이 문 개폐 도움 제공 가능",
          "실내 좌석 안내 지원"
        ],
        "facility_improvements": [
          "자동문 설치 검토",
          "입구 앞 회전 공간 확대",
          "휠체어 이용자를 위한 안내 표시 설치"
        ]
      }
    }
  },
  {
    "kakao_mapping": {
      "place_id": "2071704405",
      "place_name": "평화김해뒷고기",
      "coordinates": {
        "lat": 37.558777340123,
        "lng": 126.936233371478
      }
    },
    "accessibility_info": {
      "accessibility_score": 10
    },
    "llm_analysis": {
      "final_accessibility_score": 10,
      "access_recommendation": "independent",
      "stairs_count": 0,
      "stairs_height": "계단 없음 - 평지 접근",
      "stair_severity_assessment": "계단이 감지되지 않았으며, 건물 입구가 보도와 동일한 높이에 위치해 있어 휠체어 접근에 전혀 문제가 없습니다.",
      "observations": [
        "건물 입구가 보도와 완전히 평지로 연결되어 있음",
        "충분한 너비의 유리문으로 휠체어 통행에 적합",
        "점자블록이 설치되어 있어 시각장애인 접근성도 양호",
        "입구 앞 공간이 넓어 휠체어 회전 및 대기 공간 충분"
      ],
      "recommendations": {
        "for_independent": [
          "입구 양옆의 광고 입간판 사이로 충분한 공간이 있어 안전하게 진입 가능",
          "점자블록을 따라 이동하면 더욱 안전한 접근 가능"
        ],
        "for_assisted": [
          "동행인 없이도 안전하게 접근 가능한 환경",
          "필요시 입간판 위치 조정을 요청할 수 있음"
        ],
        "facility_improvements": [
          "현재 상태가 양호하나, 입구 자동문 설치 시 더욱 편리한 접근 가능",
          "우천 시를 대비한 입구 캐노피 설치 고려"
        ]
      }
    }
  },
  {
    "kakao_mapping": {
      "place_id": "1580106975",
      "place_name": "플릭온커피",
      "coordinates": {
        "lat": 37.5578586447476,
        "lng": 126.938886004379
      }
    },
    "accessibility_info": {
      "accessibility_score": 10
    },
    "llm_analysis": {
      "error": "HTTP 오류: 529",
      "summary": "접근성 점수 10점. 계단이 감지되지 않았으며 평지 접근이 가능한 카페입니다.",
      "observations": [
        "카페 입구가 평지에 위치하여 접근성이 우수함",
        "보도와 자연스럽게 연결되어 있음"
      ]
    }
  },
  {
    "kakao_mapping": {
      "place_id": "1504964318",
      "place_name": "행복가득약국",
      "coordinates": {
        "lat": 37.5563071297207,
        "lng": 126.934520427944
      }
    },
    "accessibility_info": {
      "accessibility_score": 10
    },
    "llm_analysis": {
      "final_accessibility_score": 9,
      "access_recommendation": "independent",
      "stairs_count": 0,
      "stairs_height": "계단 없음",
      "stair_severity_assessment": "이미지에서 계단이 확인되지 않으며, 평지 접근이 가능한 구조",
      "observations": [
        "K-Square 약국 건물 1층 위치로 계단 없이 접근 가능",
        "넓은 자동문 설치로 휠체어 통행 용이",
        "입구 전면 평탄한 보도블록 시공",
        "충분한 전면 공간으로 휠체어 회전 가능",
        "야간 조명 설치로 시야 확보 양호"
      ],
      "recommendations": {
        "for_independent": [
          "자동문으로 휠체어 독립 진입 가능",
          "입구 전면 평탄한 보도블록으로 안전한 접근",
          "충분한 회전 공간 확보됨"
        ],
        "for_assisted": [
          "동행인 없이도 접근 가능하나, 약국 내부 이동 시 동행 도움이 있으면 더욱 편리",
          "야간 이용 시 시야 확보를 위한 동행 권장"
        ],
        "facility_improvements": [
          "현재 접근성 우수 - 추가 개선사항 없음",
          "입구 점자블록 설치 고려 (시각장애인 접근성)",
          "우천 시 미끄럼 방지 매트 설치 권장"
        ]
      }
    }
  },
  {
    "kakao_mapping": {
      "place_id": "13510295",
      "place_name": "현우약국",
      "coordinates": {
        "lat": 37.5583362186341,
        "lng": 126.936748253264
      }
    },
    "accessibility_info": {
      "accessibility_score": 10
    },
    "llm_analysis": {
      "final_accessibility_score": 9,
      "access_recommendation": "independent",
      "stairs_count": 0,
      "stairs_height": "계단 없음",
      "stair_severity_assessment": "이미지와 검출 결과 모두에서 계단이 확인되지 않음. 평지 접근 가능한 입구로 판단됨",
      "observations": [
        "평지에 위치한 상가 건물로 계단 없이 접근 가능",
        "보도와 입구가 동일 평면에 위치",
        "입구 주변 공간이 넓어 휠체어 회전 용이",
        "건물 검출 신뢰도(0.97)와 보도 검출 신뢰도(1.00)가 매우 높음"
      ],
      "recommendations": {
        "for_independent": [
          "입구까지 평탄한 보도를 통해 안전하게 접근 가능",
          "출입구 앞 충분한 회전 공간 확보됨",
          "날씨가 좋지 않을 때는 보도의 미끄러움 주의"
        ],
        "for_assisted": [
          "독립 접근이 충분히 가능하나, 필요시 문 개폐 보조",
          "실내 진입 후 안내가 필요할 수 있음"
        ],
        "facility_improvements": [
          "출입구에 자동문 설치 고려",
          "야간 조명 강화로 시인성 개선",
          "우천 시를 대비한 차양 설치 검토"
        ]
      }
    }
  },
  {
    "kakao_mapping": {
      "place_id": "730405400",
      "place_name": "CU 뉴신촌역점",
      "coordinates": {
        "lat": 37.5558311934312,
        "lng": 126.937798700666
      }
    },
    "accessibility_info": {
      "accessibility_score": 8
    },
    "facility_info": {
      "available": true,
      "accessibility_details": {
        "entrance": {
          "accessible": true,
          "features": ["주출입구 높이차이 제거", "주출입구 접근로", "주출입구(문)"]
        },
        "elevator": {
          "available": false
        }
      }
    },
    "llm_analysis": {
      "final_accessibility_score": 7,
      "stairs_count": 2,
      "stairs_height": "약 10-15cm 높이의 낮은 계단 2개",
      "stair_severity_assessment": "입구에 2개의 낮은 계단이 있으나 높이가 낮아 경미한 수준입니다. 휠체어 사용자에게는 여전히 장애물이지만, 보행 보조기구 사용자나 시각장애인에게는 큰 문제가 되지 않을 정도입니다.",
      "alternative_route": true,
      "alternative_route_description": "공공데이터에 따르면 주출입구 높이차이 제거 및 접근로가 설치되어 있어, 측면이나 다른 위치에 휠체어 접근 가능한 경사로나 평탄한 입구가 있을 가능성이 높습니다.",
      "observations": [
        "CU 편의점이 1층에 위치하여 접근성이 양호합니다",
        "입구가 넓고 개방적이어서 전반적인 접근성은 좋은 편입니다",
        "보도 상태가 양호하여 건물까지의 접근은 원활합니다",
        "공공데이터상 승강기와 주출입구 접근로가 있다고 되어 있으나, 현재 이미지에서는 계단만 확인됩니다"
      ],
      "recommendations": {
        "for_independent": [
          "주출입구 외 휠체어 접근 가능한 대체 입구 위치를 명확히 표시할 것을 권장합니다"
        ],
        "for_assisted": [
          "계단 측면에 간이 경사로 설치를 고려해보세요",
          "계단 가장자리에 시각장애인을 위한 점자블록 설치가 필요합니다"
        ]
      }
    }
  },
  {
    "kakao_mapping": {
      "place_id": "2116784344",
      "place_name": "CU 신촌르메이에르점",
      "coordinates": {
        "lat": 37.5564623964348,
        "lng": 126.939992863232
      }
    },
    "accessibility_info": {
      "accessibility_score": 10
    },
    "llm_analysis": {
      "final_accessibility_score": 10,
      "access_recommendation": "independent",
      "stairs_count": 0,
      "stairs_height": "계단 없음",
      "stair_severity_assessment": "이미지에서 계단이 확인되지 않으며, 입구가 평지와 같은 높이에 위치함",
      "observations": [
        "CU 편의점 입구가 보도와 같은 높이에 위치함",
        "입구 앞에 충분한 회전 공간이 확보됨",
        "평탄하고 넓은 보도가 잘 정비되어 있음",
        "출입문이 자동문 또는 개방형으로 보임",
        "진열대나 기타 장애물이 입구를 방해하지 않음"
      ],
      "recommendations": {
        "for_independent": [
          "현재 상태로 독립 접근이 완전히 가능함",
          "넓은 보도와 평탄한 진입로를 그대로 유지할 것"
        ],
        "for_assisted": [
          "동행 지원이 특별히 필요하지 않음"
        ],
        "facility_improvements": [
          "현재 우수한 접근성을 유지하고 있음",
          "입구 앞 공간을 항상 깨끗하게 유지할 것"
        ]
      }
    }
  },
  {
    "kakao_mapping": {
      "place_id": "1687557623",
      "place_name": "CU 마포세울점",
      "coordinates": {
        "lat": 37.5558722071888,
        "lng": 126.941174759725
      }
    },
    "accessibility_info": {
      "accessibility_score": 8
    },
    "llm_analysis": {
      "final_accessibility_score": 9,
      "access_recommendation": "assisted",
      "stairs_count": 2,
      "stairs_height": "약 20-30cm (각 계단 10-15cm 높이)",
      "stair_severity_assessment": "경미한 수준의 계단으로, 전체 높이가 낮고 계단 수가 적어 동행인의 도움이 있다면 충분히 극복 가능한 장애물입니다.",
      "observations": [
        "GS25 편의점 입구에 2단의 낮은 계단 확인",
        "계단 검출 신뢰도가 0.82로 높아 정확한 분석 가능",
        "출입문은 자동문으로 보이며 폭이 충분해 보임",
        "보도와 연결되어 있으나 계단이 주요 장애물",
        "난간은 있으나 경사로는 설치되지 않음"
      ],
      "recommendations": {
        "for_independent": [
          "현재 상태에서는 독립적 접근이 어려움",
          "휠체어 사용자는 반드시 사전에 동행인 확보 필요",
          "매장 직원에게 도움 요청 가능성 확인"
        ],
        "for_assisted": [
          "1-2명의 동행인이 있다면 안전하게 접근 가능",
          "계단이 낮아 휠체어를 들어올리기 비교적 수월함",
          "물병 박스는 필요시 이동 가능"
        ],
        "facility_improvements": [
          "휴대용 경사로 설치로 즉시 접근성 개선 가능",
          "장기적으로는 고정식 경사로 설치 권장",
          "입구 앞 평탄 공간 확보 필요"
        ]
      }
    }
  },
  {
    "kakao_mapping": {
      "place_id": "1011003181",
      "place_name": "CU 마포신촌로터리점",
      "coordinates": {
        "lat": 37.5543277907154,
        "lng": 126.936784234683
      }
    },
    "accessibility_info": {
      "accessibility_score": 10
    },
    "llm_analysis": {
      "final_accessibility_score": 10,
      "access_recommendation": "independent",
      "stairs_count": 0,
      "stairs_height": "계단 없음",
      "stair_severity_assessment": "이미지에서 계단이 전혀 관찰되지 않으며, 편의점 입구까지 평탄한 보도로 연결되어 있습니다.",
      "observations": [
        "CU 편의점 1층 입구로 계단 없이 평탄한 접근",
        "보도가 잘 정비되어 있음",
        "입구 전면 공간이 충분함",
        "문턱이 없거나 매우 낮아 보임",
        "주변에 이동을 방해하는 장애물 없음"
      ],
      "recommendations": {
        "for_independent": [
          "보도에서 직접 진입 가능",
          "문 앞 공간이 충분하여 휠체어 회전 가능",
          "평탄한 접근로 이용"
        ],
        "for_assisted": [
          "동행인 도움 없이도 충분히 접근 가능",
          "필요시 문 개폐 도움만 요청"
        ],
        "facility_improvements": [
          "자동문 설치 시 접근성 더욱 향상",
          "입구 전면 점자블록 설치 권장"
        ]
      }
    }
  },
  {
    "kakao_mapping": {
      "place_id": "1699404842",
      "place_name": "CU마포아이비점",
      "coordinates": {
        "lat": 37.5540455131893,
        "lng": 126.93579173517
      }
    },
    "accessibility_info": {
      "accessibility_score": 10
    },
    "llm_analysis": {
      "final_accessibility_score": 9,
      "access_recommendation": "independent",
      "stairs_count": 0,
      "stairs_height": "계단 없음",
      "stair_severity_assessment": "계단이 감지되지 않았으며, 건물 입구가 보도와 평면으로 연결되어 있습니다",
      "observations": [
        "편의점(CU) 건물로 평면 접근 가능",
        "보도와 입구가 동일 레벨로 연결",
        "입구 전면에 충분한 회전 공간 확보",
        "야외 테이블과 파라솔이 설치되어 있으나 통행 가능",
        "벤치가 보도 옆에 위치하나 충분한 통행 폭 확보"
      ],
      "recommendations": {
        "for_independent": [
          "입구까지 평면 이동 가능",
          "자동문 설치 여부 확인 권장",
          "야외 테이블 구역 피해서 이동"
        ],
        "for_assisted": [
          "동행인이 문 개폐 도움 제공 가능",
          "혼잡 시간대 피하기 권장"
        ],
        "facility_improvements": [
          "자동문 설치 검토",
          "점자블록 설치로 시각장애인 접근성 향상",
          "야외 좌석 구역과 통행로 명확한 구분"
        ]
      }
    }
  },
  {
    "kakao_mapping": {
      "place_id": "1825743476",
      "place_name": "CU 신촌기차역점",
      "coordinates": {
        "lat": 37.5588856044928,
        "lng": 126.94174428198
      }
    },
    "accessibility_info": {
      "accessibility_score": 10
    },
    "llm_analysis": {
      "final_accessibility_score": 10,
      "access_recommendation": "independent",
      "stairs_count": 0,
      "stairs_height": "계단 없음",
      "stair_severity_assessment": "계단이 감지되지 않았으며, 평지 진입이 가능한 것으로 확인됨",
      "observations": [
        "CU 편의점 출입구가 평지에 위치",
        "계단이나 턱이 없는 평탄한 진입로",
        "출입구 앞 충분한 공간 확보",
        "보도와 자연스럽게 연결된 진입부",
        "유리문으로 내부 시야 확보 가능"
      ],
      "recommendations": {
        "for_independent": [
          "현재 상태로 충분히 접근 가능",
          "자동문이 있다면 더욱 편리할 것으로 예상",
          "출입구 앞 공간이 충분하여 휠체어 회전 가능"
        ],
        "for_assisted": [
          "동행인 도움 없이도 접근 가능",
          "필요시 문 개폐 도움 정도만 필요할 수 있음"
        ],
        "facility_improvements": [
          "자동문 설치 고려",
          "출입구 앞 점자블록 설치로 시각장애인 접근성 향상",
          "우천시 미끄럼 방지 매트 설치"
        ]
      }
    }
  },
  {
    "kakao_mapping": {
      "place_id": "19201450",
      "place_name": "CU신촌까사빌점",
      "coordinates": {
        "lat": 37.5545167136847,
        "lng": 126.935422277226
      }
    },
    "accessibility_info": {
      "accessibility_score": 10
    },
    "llm_analysis": {
      "final_accessibility_score": 9,
      "access_recommendation": "independent",
      "stairs_count": 0,
      "stairs_height": "계단 없음 - 평지 접근",
      "stair_severity_assessment": "계단이 감지되지 않았으며, 매장 입구까지 평탄한 보도로 연결되어 있습니다.",
      "observations": [
        "CU 편의점 입구는 평지에 위치하여 계단 없이 접근 가능",
        "넓은 보도가 확보되어 있어 휠체어 통행이 원활함",
        "매장 앞 휴식공간이 보도와 분리되어 통행에 방해되지 않음",
        "유리문으로 되어 있어 내부 시야 확보가 가능함"
      ],
      "recommendations": {
        "for_independent": [
          "보도의 평탄성이 양호하여 휠체어 독립 접근이 원활합니다",
          "벤치 주변 통행 시 충분한 공간을 확보하여 이동하세요"
        ],
        "for_assisted": [
          "동행인이 있을 경우 더욱 편안한 접근이 가능합니다",
          "필요시 동행인이 문 개방을 도와줄 수 있습니다"
        ],
        "facility_improvements": [
          "현재 접근성이 우수하여 특별한 개선사항이 없습니다",
          "입구 자동문 설치 시 완벽한 접근성 확보 가능"
        ]
      }
    }
  },
  {
    "kakao_mapping": {
      "place_id": "1261071612",
      "place_name": "CU 신촌푸르지오점",
      "coordinates": {
        "lat": 37.5573527481625,
        "lng": 126.942500021232
      }
    },
    "accessibility_info": {
      "accessibility_score": 8
    },
    "llm_analysis": {
      "final_accessibility_score": 9,
      "access_recommendation": "assisted",
      "stairs_count": 2,
      "stairs_height": "약 20-30cm (일반적인 낮은 계단 2개)",
      "stair_severity_assessment": "경미한 수준의 계단으로, 입구까지 2단의 낮은 계단이 있음. 높이는 표준적이나 휠체어 독립 접근에는 장애가 됨",
      "observations": [
        "CU 편의점 정면 입구에 2단의 계단 확인",
        "계단 검출 신뢰도 0.89로 높은 정확도",
        "점자블록 설치로 시각장애인 배려 확인",
        "자동문 설치로 문턱 장벽은 없음",
        "보도와 연결성은 양호하나 단차 존재"
      ],
      "recommendations": {
        "for_independent": [
          "현재 상태로는 휠체어 독립 접근 불가능",
          "인근 경사로가 있는 다른 매장 이용 권장"
        ],
        "for_assisted": [
          "동행인 1-2명의 도움으로 계단 통과 가능",
          "계단이 낮아 비교적 안전하게 도움받을 수 있음",
          "입구 자동문으로 계단만 통과하면 매장 이용 가능"
        ],
        "facility_improvements": [
          "휴대용 경사로 설치로 즉시 접근성 개선 가능",
          "영구적 경사로 설치 권장 (좌측 공간 활용 가능)",
          "계단 측면 손잡이 설치로 보행 약자 안전성 향상"
        ]
      }
    }
  },
  {
    "kakao_mapping": {
      "place_id": "16875983",
      "place_name": "CU 창천점",
      "coordinates": {
        "lat": 37.557036229264,
        "lng": 126.93470573771
      }
    },
    "accessibility_info": {
      "accessibility_score": 10
    },
    "llm_analysis": {
      "final_accessibility_score": 10,
      "access_recommendation": "independent",
      "stairs_count": 0,
      "stairs_height": "계단 없음",
      "stair_severity_assessment": "이미지와 분석 결과 모두 계단이 감지되지 않았습니다. 편의점 입구는 평면 접근이 가능합니다.",
      "observations": [
        "CU 편의점으로 평면 접근이 가능한 구조입니다",
        "입구 앞 보도가 평탄하고 충분한 폭을 확보하고 있습니다",
        "횡단보도와 연결된 경사로가 잘 조성되어 있습니다",
        "입구 문이 유리문으로 되어 있어 시야 확보가 용이합니다",
        "외부 장애물이 통행로를 방해하지 않도록 배치되어 있습니다"
      ],
      "recommendations": {
        "for_independent": [
          "현재 상태로도 충분히 접근 가능합니다",
          "보도블럭의 요철에 주의하며 진입하시기 바랍니다",
          "횡단보도 경사로를 이용하여 안전하게 접근하세요"
        ],
        "for_assisted": [
          "동행인의 도움 없이도 독립적 접근이 가능합니다",
          "필요시 매장 직원에게 도움을 요청할 수 있습니다"
        ],
        "facility_improvements": [
          "현재 접근성이 양호하므로 특별한 개선사항 없음",
          "향후 자동문 설치를 고려하면 더욱 편리할 것입니다"
        ]
      }
    }
  },
  {
    "kakao_mapping": {
      "place_id": "17056684",
      "place_name": "GS25 신촌사랑점",
      "coordinates": {
        "lat": 37.5568259560692,
        "lng": 126.937403683803
      }
    },
    "accessibility_info": {
      "accessibility_score": 2
    },
    "llm_analysis": {
      "final_accessibility_score": 8,
      "access_recommendation": "assisted",
      "stairs_count": 1,
      "stairs_height": "약 10-15cm 정도의 낮은 단차",
      "stair_severity_assessment": "경미한 수준의 단차로, 편의점 입구에 일반적으로 존재하는 문턱 정도의 높이입니다. 휠체어 사용자에게는 장애요소이지만 극복 가능한 수준입니다.",
      "observations": [
        "전형적인 GS25 편의점 입구 구조",
        "점자블록이 설치되어 있어 장애인 접근성 고려가 일부 되어 있음",
        "입구 폭은 휠체어 통행에 충분해 보임",
        "바닥이 평탄하고 보도와 잘 연결되어 있음"
      ],
      "recommendations": {
        "for_independent": [
          "휠체어 앞바퀴를 살짝 들어 단차를 넘는 기술이 필요합니다",
          "입구 진입 시 충분한 공간 확보를 위해 진열대 쪽을 피해 접근하세요"
        ],
        "for_assisted": [
          "동행인이 휠체어 뒤쪽을 살짝 들어주면 쉽게 진입 가능합니다",
          "1명의 도움으로 충분히 접근 가능한 수준입니다"
        ],
        "facility_improvements": [
          "간이 경사로 설치를 권장합니다",
          "입구 앞 진열대 위치 조정으로 통행 폭 확보 필요",
          "문턱 제거 또는 높이 최소화 공사 검토"
        ]
      }
    }
  },
  {
    "kakao_mapping": {
      "place_id": "12297053",
      "place_name": "GS25 신촌점",
      "coordinates": {
        "lat": 37.5563377699349,
        "lng": 126.936344324387
      }
    },
    "accessibility_info": {
      "accessibility_score": 8
    },
    "llm_analysis": {
      "final_accessibility_score": 9,
      "access_recommendation": "assisted",
      "stairs_count": 1,
      "stairs_height": "약 10-15cm 정도의 낮은 단차",
      "stair_severity_assessment": "편의점 입구에 1단의 낮은 계단이 있으나, 높이가 비교적 낮아 동행인의 도움이 있으면 쉽게 극복 가능한 수준입니다. 독립 접근 시에는 휠체어 사용자가 스스로 극복하기 어려울 수 있습니다.",
      "observations": [
        "GS25 편의점 입구에 1단의 낮은 계단 확인",
        "입구 문이 전면 유리로 되어 있어 넓고 개방적",
        "보도와 연결성은 양호하나 단차가 존재",
        "점포 앞 공간이 충분하여 휠체어 회전 가능",
        "검출 신뢰도가 0.80으로 높아 계단 검출 결과를 신뢰할 수 있음"
      ],
      "recommendations": {
        "for_independent": [
          "휴대용 경사판 사용을 고려하세요",
          "점포 측에 임시 경사판 설치 요청을 시도해보세요",
          "가능하면 동행인과 함께 방문하는 것을 권장합니다"
        ],
        "for_assisted": [
          "1명의 동행인이면 충분히 진입 가능합니다",
          "계단이 낮아 휠체어를 살짝 들어올리는 정도로 극복 가능합니다",
          "입구가 넓어 회전 공간은 충분합니다"
        ],
        "facility_improvements": [
          "간단한 휴대용 경사판 비치를 권장합니다",
          "영구적인 소형 경사로 설치가 가장 이상적입니다",
          "단차 해소를 위한 경사 블록 설치를 고려하세요"
        ]
      }
    }
  },
  {
    "kakao_mapping": {
      "place_id": "27498588",
      "place_name": "GS25 노고산호호점",
      "coordinates": {
        "lat": 37.554654214226,
        "lng": 126.938130028409
      }
    },
    "accessibility_info": {
      "accessibility_score": 8
    },
    "llm_analysis": {
      "final_accessibility_score": 9,
      "access_recommendation": "assisted",
      "stairs_count": 1,
      "stairs_height": "약 15-20cm 정도의 낮은 단차",
      "stair_severity_assessment": "매우 경미한 수준의 단차로, 편의점 입구에 흔히 있는 도로와 건물 사이의 높이 차이로 판단됨. 검출된 계단은 매우 작은 면적(0.3%)으로 실제 심각한 장애물은 아님",
      "observations": [
        "GS25 편의점으로 일반적인 상업 건물",
        "입구 앞 보도가 넓고 평탄하여 접근성 양호",
        "유리문으로 내부가 잘 보여 시인성 좋음",
        "검출된 계단은 매우 작은 면적으로 실제로는 경미한 단차로 판단",
        "전반적으로 접근성이 양호한 편의점"
      ],
      "recommendations": {
        "for_independent": [
          "낮은 단차이므로 숙련된 휠체어 사용자는 독립적 접근 가능",
          "단차 부분에서 속도를 줄이고 조심스럽게 접근 권장",
          "가능하면 단차가 가장 낮은 부분으로 접근"
        ],
        "for_assisted": [
          "동행인이 있을 경우 단차 통과 시 가벼운 보조만으로 충분",
          "휠체어 앞바퀴를 살짝 들어주는 정도의 도움으로 안전하게 진입 가능"
        ],
        "facility_improvements": [
          "작은 경사판 설치로 완전한 무장애 접근 가능",
          "단차 부분에 시각적 표시로 안전성 향상",
          "자동문 설치 시 더욱 편리한 접근 가능"
        ]
      }
    }
  },
  {
    "kakao_mapping": {
      "place_id": "131754034",
      "place_name": "에버그린약국",
      "coordinates": {
        "lat": 37.5573527481625,
        "lng": 126.942500021232
      }
    },
    "accessibility_info": {
      "accessibility_score": 10
    },
    "facility_info": {
      "available": true,
      "accessibility_details": {
        "entrance": {
          "accessible": true,
          "features": ["주출입구 높이차이 제거", "주출입구 접근로", "주출입구(문)"]
        },
        "restroom": {
          "available": true,
          "features": ["장애인사용가능화장실"]
        },
        "parking": {
          "available": true,
          "features": ["장애인전용주차구역"]
        }
      }
    },
    "llm_analysis": {
      "final_accessibility_score": 9,
      "observations": [
        "신촌푸르지오시티 1층에 위치한 의바른약국으로 평지 진입 가능",
        "넓은 보도블록이 설치되어 있어 휠체어 접근이 용이함",
        "유리문으로 된 입구가 명확히 식별 가능"
      ]
    }
  },
  {
    "kakao_mapping": {
      "place_id": "1114731898",
      "place_name": "연대포분점",
      "coordinates": {
        "lat": 37.5584586308496,
        "lng": 126.935851554504
      }
    },
    "accessibility_info": {
      "accessibility_score": 10
    },
    "llm_analysis": {
      "final_accessibility_score": 9,
      "observations": [
        "건물 앞 보도가 평탄하고 넓게 조성되어 있음",
        "입구까지 계단이나 턱이 없는 평탄한 접근로",
        "주차 공간과 보행로가 명확히 구분되어 있음"
      ]
    }
  },
  {
    "kakao_mapping": {
      "place_id": "855767372",
      "place_name": "오늘통닭 신촌직영점",
      "coordinates": {
        "lat": 37.5590445216786,
        "lng": 126.936467197506
      }
    },
    "accessibility_info": {
      "accessibility_score": 10
    },
    "llm_analysis": {
      "final_accessibility_score": 10,
      "observations": [
        "건물 1층 상가 입구가 보도와 동일한 높이에 위치",
        "입구까지 평탄한 경로 확보",
        "충분한 입구 너비로 휠체어 접근 용이"
      ]
    }
  },
  {
    "kakao_mapping": {
      "place_id": "11518579",
      "place_name": "위드팜신촌약국",
      "coordinates": {
        "lat": 37.5607282670759,
        "lng": 126.94126714618
      }
    },
    "accessibility_info": {
      "accessibility_score": 8
    },
    "llm_analysis": {
      "final_accessibility_score": 9,
      "stairs_count": 2,
      "stair_severity_assessment": "경미한 수준의 계단으로 약국 입구에 1-2단 정도의 낮은 단차가 있습니다."
    }
  },
  {
    "kakao_mapping": {
      "place_id": "104532017",
      "place_name": "유자유 김치떡볶이 신촌점",
      "coordinates": {
        "lat": 37.5590255998908,
        "lng": 126.935633878417
      }
    },
    "accessibility_info": {
      "accessibility_score": 8
    },
    "llm_analysis": {
      "final_accessibility_score": 9,
      "observations": [
        "입구가 자동문으로 보여 문 개폐는 용이할 것으로 예상",
        "보도와 입구 사이 공간이 평탄하고 넓음"
      ]
    }
  },
  {
    "kakao_mapping": {
      "place_id": "15522943",
      "place_name": "이디야커피 연세대점",
      "coordinates": {
        "lat": 37.5588610117482,
        "lng": 126.937523648298
      }
    },
    "accessibility_info": {
      "accessibility_score": 10
    },
    "llm_analysis": {
      "error": "HTTP 오류: 529"
    }
  },
  {
    "kakao_mapping": {
      "place_id": "560279683",
      "place_name": "이로운약국",
      "coordinates": {
        "lat": 37.5583684806137,
        "lng": 126.943137336942
      }
    },
    "accessibility_info": {
      "accessibility_score": 10
    },
    "llm_analysis": {
      "error": "HTTP 오류: 529"
    }
  },
  {
    "kakao_mapping": {
      "place_id": "902853559",
      "place_name": "이씨 서울신촌점",
      "coordinates": {
        "lat": 37.5585661705571,
        "lng": 126.939533144555
      }
    },
    "accessibility_info": {
      "accessibility_score": 8
    },
    "llm_analysis": {
      "error": "HTTP 오류: 529"
    }
  },
  {
    "kakao_mapping": {
      "place_id": "8528629",
      "place_name": "일심약국",
      "coordinates": {
        "lat": 37.5592424617438,
        "lng": 126.937123694466
      }
    },
    "accessibility_info": {
      "accessibility_score": 10
    },
    "llm_analysis": {
      "final_accessibility_score": 9,
      "observations": [
        "1층 상업 시설로 평지 접근 가능",
        "보도가 잘 정비되어 있음",
        "입구가 도로면과 같은 높이에 위치"
      ]
    }
  },
  {
    "kakao_mapping": {
      "place_id": "18757209",
      "place_name": "자연담은화로 신촌점",
      "coordinates": {
        "lat": 37.5588601748192,
        "lng": 126.935136261666
      }
    },
    "accessibility_info": {
      "accessibility_score": 10
    },
    "llm_analysis": {
      "final_accessibility_score": 10,
      "observations": [
        "음식점 입구가 도로면과 같은 높이에 위치",
        "입구 앞 보도가 넓고 평탄하게 정비됨",
        "횡단보도가 바로 앞에 있어 접근성 우수"
      ]
    }
  },
  {
    "kakao_mapping": {
      "place_id": "10720026",
      "place_name": "정문약국",
      "coordinates": {
        "lat": 37.5592388458024,
        "lng": 126.936763901223
      }
    },
    "accessibility_info": {
      "accessibility_score": 10
    },
    "llm_analysis": {
      "final_accessibility_score": 10,
      "observations": [
        "약국 건물로 1층에 위치하여 계단이 없음",
        "출입구가 보도블록과 동일한 높이에 위치",
        "넓은 유리문으로 구성되어 출입이 용이함"
      ]
    }
  },
  {
    "kakao_mapping": {
      "place_id": "9281163",
      "place_name": "주차편한우리약국",
      "coordinates": {
        "lat": 37.5611734948493,
        "lng": 126.941722241069
      }
    },
    "accessibility_info": {
      "accessibility_score": 8
    },
    "llm_analysis": {
      "final_accessibility_score": 5,
      "stairs_count": 5,
      "stair_severity_assessment": "건물 입구까지 5단의 계단이 있어 휠체어 사용자가 혼자서는 접근이 거의 불가능한 심각한 수준입니다."
    }
  },
  {
    "kakao_mapping": {
      "place_id": "1743190128",
      "place_name": "중경마라탕",
      "coordinates": {
        "lat": 37.5588207663976,
        "lng": 126.935897307674
      }
    },
    "accessibility_info": {
      "accessibility_score": 10
    },
    "llm_analysis": {
      "final_accessibility_score": 9,
      "observations": [
        "1층 상가 입구가 보도와 동일한 높이에 위치",
        "유리 자동문 또는 여닫이문으로 충분한 너비 확보",
        "입구 앞 평탄한 보도 블록 설치"
      ]
    }
  },
  {
    "kakao_mapping": {
      "place_id": "678652823",
      "place_name": "치히로 신촌점",
      "coordinates": {
        "lat": 37.5588376207857,
        "lng": 126.935411870786
      }
    },
    "accessibility_info": {
      "accessibility_score": 10
    },
    "llm_analysis": {
      "final_accessibility_score": 9,
      "observations": [
        "지하 1층 음식점으로 계단 대신 경사로 형태의 평지 접근 구조",
        "보도블록이 평탄하고 연속적임",
        "입구가 충분히 넓어 휠체어 통행 가능"
      ]
    }
  },
  {
    "kakao_mapping": {
      "place_id": "10809579",
      "place_name": "크리스터_치킨",
      "coordinates": {
        "lat": 37.559015076325,
        "lng": 126.935172910477
      }
    },
    "accessibility_info": {
      "accessibility_score": 8
    },
    "llm_analysis": {
      "final_accessibility_score": 9,
      "stairs_count": 1,
      "stair_severity_assessment": "건물 입구 앞에 낮은 단차가 1개 있음. 경미한 수준으로 휠체어 사용자가 혼자서도 어렵지만 접근 가능할 수 있으며, 동행인 1명의 도움으로 쉽게 극복 가능"
    }
  },
  {
    "kakao_mapping": {
      "place_id": "8122805",
      "place_name": "클로리스 신촌점",
      "coordinates": {
        "lat": 37.557750825842,
        "lng": 126.938770878428
      }
    },
    "accessibility_info": {
      "accessibility_score": 8
    },
    "llm_analysis": {
      "final_accessibility_score": 9,
      "stairs_count": 1,
      "stair_severity_assessment": "건물 입구에 1단의 낮은 계단이 존재합니다."
    }
  },
  {
    "kakao_mapping": {
      "place_id": "804577234",
      "place_name": "투썸플레이스 마포노고산점",
      "coordinates": {
        "lat": 37.5557422183902,
        "lng": 126.93997159818
      }
    },
    "accessibility_info": {
      "accessibility_score": 8
    },
    "llm_analysis": {
      "final_accessibility_score": 9,
      "stairs_count": 3,
      "stair_severity_assessment": "경미한 수준의 계단으로, 상가 건물 입구에 흔히 있는 3단 정도의 낮은 계단입니다."
    }
  }
];

async function migrateAttachedPOIData() {
  console.log('🚀 Starting attached POI data migration...');
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const reportData of poiReports) {
    try {
      const kakaoPlaceId = reportData.kakao_mapping.place_id;
      const placeName = reportData.kakao_mapping.place_name;
      const latitude = reportData.kakao_mapping.coordinates.lat.toString();
      const longitude = reportData.kakao_mapping.coordinates.lng.toString();
      
      console.log(`\n📁 Processing: ${placeName} (${kakaoPlaceId})`);
      
      // Check if place already exists
      const existingPlace = await db.select()
        .from(places)
        .where(eq(places.kakaoPlaceId, kakaoPlaceId))
        .limit(1);
      
      let placeId: number;
      
      if (existingPlace.length > 0) {
        console.log(`📍 Place already exists: ${placeName}`);
        placeId = existingPlace[0].id;
      } else {
        // Create new place
        const [newPlace] = await db.insert(places).values({
          kakaoPlaceId,
          placeName,
          latitude,
          longitude,
          accessibilityScore: reportData.accessibility_info.accessibility_score
        }).returning();
        
        placeId = newPlace.id;
        console.log(`✅ Created new place: ${placeName}`);
      }
      
      // Check if accessibility data already exists
      const existingAccessibility = await db.select()
        .from(accessibilityReports)
        .where(eq(accessibilityReports.kakaoPlaceId, kakaoPlaceId))
        .limit(1);
      
      if (existingAccessibility.length > 0) {
        console.log(`📊 Accessibility data already exists for: ${placeName}`);
        continue;
      }
      
      // Prepare accessibility data
      let summary = '';
      let recommendations: string[] = [];
      let highlightedObstacles: string[] = [];
      let aiAnalysis: any = {};
      let facilityDetails: any = {};
      
      // Handle different llm_analysis structures
      if (reportData.llm_analysis) {
        if (reportData.llm_analysis.error) {
          // Handle error cases
          summary = `접근성 점수: ${reportData.accessibility_info.accessibility_score}점. 상세 분석 데이터 처리 중입니다.`;
          recommendations = ['상세 접근성 정보는 추후 업데이트됩니다.'];
        } else {
          // Normal case with full llm_analysis
          if (reportData.llm_analysis.observations) {
            summary = reportData.llm_analysis.observations.join(' ');
          } else if (reportData.llm_analysis.stair_severity_assessment) {
            summary = reportData.llm_analysis.stair_severity_assessment;
          } else {
            summary = `접근성 점수: ${reportData.accessibility_info.accessibility_score}점`;
          }
          
          // Extract recommendations
          if (reportData.llm_analysis.recommendations) {
            if (Array.isArray(reportData.llm_analysis.recommendations)) {
              recommendations = reportData.llm_analysis.recommendations;
            } else if (typeof reportData.llm_analysis.recommendations === 'object') {
              recommendations = [
                ...(reportData.llm_analysis.recommendations.for_independent || []),
                ...(reportData.llm_analysis.recommendations.for_assisted || []),
                ...(reportData.llm_analysis.recommendations.facility_improvements || [])
              ];
            }
          }
          
          aiAnalysis = reportData.llm_analysis;
        }
      } else {
        summary = `접근성 점수: ${reportData.accessibility_info.accessibility_score}점`;
        recommendations = ['기본 접근성 정보가 제공됩니다.'];
      }
      
      // Handle facility_info
      if (reportData.facility_info) {
        facilityDetails = {
          entrance: reportData.facility_info.accessibility_details?.entrance || null,
          elevator: reportData.facility_info.accessibility_details?.elevator || null,
          restroom: reportData.facility_info.accessibility_details?.restroom || null,
          parking: reportData.facility_info.accessibility_details?.parking || null
        };
      }
      
      // Use the final accessibility score from LLM analysis if available
      const finalScore = reportData.llm_analysis?.final_accessibility_score || reportData.accessibility_info.accessibility_score;
      
      // Insert accessibility data
      await db.insert(accessibilityReports).values({
        kakaoPlaceId,
        placeId,
        accessibilityScore: finalScore,
        summary: summary.substring(0, 500), // Limit summary length
        recommendations: recommendations,
        highlightedObstacles: highlightedObstacles,
        aiAnalysis: aiAnalysis,
        facilityDetails: facilityDetails
      });
      
      console.log(`✅ Added accessibility data for: ${placeName} (score: ${finalScore})`);
      successCount++;
      
    } catch (error) {
      console.error(`❌ Error processing ${reportData.kakao_mapping.place_name}:`, error);
      errorCount++;
    }
  }
  
  console.log(`\n🎉 Attached POI migration completed!`);
  console.log(`✅ Successfully processed: ${successCount} files`);
  console.log(`❌ Errors: ${errorCount} files`);
  console.log(`📊 Total files: ${poiReports.length}`);
}

// Run the migration
migrateAttachedPOIData()
  .then(() => {
    console.log('✅ Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });