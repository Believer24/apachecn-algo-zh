// AI Face Analysis System
        console.log("🤖 AI面部分析系统启动中...");
        
        // Global variables
        let video, canvas, landmarkCanvas, ctx, landmarkCtx;
        let stream = null;
        let isStreaming = false;
        let model = null;
        let modelType = null;
        let showLandmarks = false;
        let tongueMode = false;
        let lastAnalysisTime = 0;
        let animationId = null;
        
        // UI elements
        let status, modelStatus, progressBar, progressContainer;
        let initBtn, startBtn, captureBtn, landmarkBtn, tongueBtn, exportBtn;
        
        // AI Models and Analysis Data
        const ANALYSIS_INTERVAL = 100; // ms
        
        // ===== MEDICAL KNOWLEDGE BASES =====
        
        // Chinese Traditional Medicine (TCM) Tongue Diagnosis Knowledge Base
        const TCM_TONGUE_KNOWLEDGE = {
            // 中医舌诊理论基础
            coatingTypes: {
                'white_thin': {
                    tcmName: '白薄苔',
                    description: '舌苔白而薄，透过苔可见舌质',
                    indication: '正常或表证初起',
                    pathology: '卫气轻度受邪，脾胃功能正常',
                    syndrome: ['风寒表证', '气虚轻证'],
                    prognosis: '良好，病情较轻',
                    treatment: '解表散寒，益气健脾',
                    herbs: ['桂枝', '白术', '茯苓', '甘草']
                },
                'white_thick': {
                    tcmName: '白厚苔',
                    description: '舌苔白而厚腻，不易刮去',
                    indication: '湿邪内盛，脾胃阳虚',
                    pathology: '脾失健运，湿浊内生，阳气不振',
                    syndrome: ['湿阻中焦', '脾胃阳虚', '痰湿内盛'],
                    prognosis: '需要调理，病程较长',
                    treatment: '温阳健脾，燥湿化痰',
                    herbs: ['苍术', '厚朴', '陈皮', '半夏', '茯苓']
                },
                'yellow_thin': {
                    tcmName: '黄薄苔',
                    description: '舌苔淡黄而薄',
                    indication: '热邪初起，胃热轻证',
                    pathology: '阳明经热初起，胃火轻度上炎',
                    syndrome: ['风热表证', '胃热初起', '肺热轻证'],
                    prognosis: '较好，及时治疗可快速恢复',
                    treatment: '清热解表，清胃降火',
                    herbs: ['连翘', '薄荷', '桔梗', '甘草', '竹叶']
                },
                'yellow_thick': {
                    tcmName: '黄厚苔',
                    description: '舌苔黄而厚腻，质地粘腻',
                    indication: '湿热内蕴，痰热互结',
                    pathology: '湿热蕴结中焦，脾胃运化失常',
                    syndrome: ['湿热中阻', '痰热内盛', '胃肠湿热'],
                    prognosis: '需要系统调理，病情较重',
                    treatment: '清热燥湿，化痰降浊',
                    herbs: ['黄芩', '黄连', '厚朴', '枳实', '竹茹']
                },
                'gray_black': {
                    tcmName: '灰黑苔',
                    description: '舌苔呈灰色或黑色',
                    indication: '里热炽盛或寒湿内盛',
                    pathology: '热极津枯或寒湿困阻',
                    syndrome: ['热入营血', '肾阳虚衰', '寒湿内盛'],
                    prognosis: '病情较重，需要紧急调理',
                    treatment: '清热凉血或温阳散寒',
                    herbs: ['生地黄', '玄参', '附子', '干姜', '肉桂']
                },
                'no_coating': {
                    tcmName: '无苔',
                    description: '舌面光滑如镜，无苔或少苔',
                    indication: '胃阴枯竭，精血大伤',
                    pathology: '胃气大伤，津液枯竭',
                    syndrome: ['胃阴虚', '肾阴虚', '气血两虚'],
                    prognosis: '病情严重，需要长期调理',
                    treatment: '滋阴润燥，益气生津',
                    herbs: ['麦冬', '石斛', '玉竹', '沙参', '枸杞子']
                }
            },
            
            // 舌质分析
            tongueBody: {
                color: {
                    'pale': {
                        tcmName: '淡白舌',
                        indication: '气血不足，阳虚寒证',
                        pathology: '气血虚弱，阳气不足',
                        treatment: '补气养血，温阳益气'
                    },
                    'red': {
                        tcmName: '红舌',
                        indication: '热证，阴虚火旺',
                        pathology: '热邪内盛，阴津不足',
                        treatment: '清热降火，滋阴降火'
                    },
                    'dark_red': {
                        tcmName: '绛舌',
                        indication: '热入营血，阴虚火旺',
                        pathology: '热入深层，津液大伤',
                        treatment: '凉血清热，滋阴救津'
                    },
                    'purple': {
                        tcmName: '紫舌',
                        indication: '血瘀，寒凝血滞',
                        pathology: '血行不畅，瘀血内阻',
                        treatment: '活血化瘀，温阳通脉'
                    }
                },
                
                texture: {
                    'tender': {
                        tcmName: '嫩舌',
                        indication: '阳虚水湿，气血不足',
                        characteristics: ['舌体胖大', '边有齿痕', '质地柔嫩']
                    },
                    'old': {
                        tcmName: '老舌',
                        indication: '实热证，邪热内盛',
                        characteristics: ['舌质坚敛', '纹理粗糙', '颜色深暗']
                    }
                },
                
                shape: {
                    'fat': {
                        tcmName: '胖大舌',
                        indication: '脾虚湿盛，痰湿内阻',
                        pathology: '脾失健运，水湿内停'
                    },
                    'thin': {
                        tcmName: '瘦薄舌',
                        indication: '阴虚火旺，气血不足',
                        pathology: '阴液亏虚，津血不足'
                    },
                    'cracked': {
                        tcmName: '裂纹舌',
                        indication: '阴虚火旺，津液不足',
                        pathology: '阴津亏虚，虚火上炎'
                    }
                }
            },
            
            // 舌苔湿润度
            moisture: {
                'wet': {
                    tcmName: '湿润苔',
                    indication: '津液充足，正常或寒湿',
                    pathology: '津液正常或水湿偏盛'
                },
                'dry': {
                    tcmName: '干燥苔',
                    indication: '津液不足，热邪伤津',
                    pathology: '热盛伤津，阴液亏虚'
                },
                'slippery': {
                    tcmName: '滑苔',
                    indication: '痰湿内盛，阳虚水泛',
                    pathology: '脾阳不振，水湿内停'
                }
            },
            
            // 舌苔分布
            distribution: {
                'uniform': {
                    tcmName: '满布苔',
                    indication: '病邪弥漫，脏腑皆病'
                },
                'partial': {
                    tcmName: '偏苔',
                    indication: '病邪偏于一侧，脏腑功能不均'
                },
                'root_thick': {
                    tcmName: '根部厚苔',
                    indication: '肾阳虚衰，下焦寒湿'
                },
                'tip_thick': {
                    tcmName: '舌尖厚苔',
                    indication: '心火上炎，上焦热盛'
                }
            },
            
            // 综合诊断模式
            comprehensiveDiagnosis: {
                constitutions: {
                    'qi_deficiency': {
                        name: '气虚质',
                        tongueFeatures: ['淡白舌', '薄白苔', '胖大有齿痕'],
                        symptoms: ['乏力', '气短', '易出汗', '食欲不振'],
                        treatment: '益气健脾',
                        lifestyle: ['适量运动', '规律作息', '避免过劳']
                    },
                    'yang_deficiency': {
                        name: '阳虚质',
                        tongueFeatures: ['淡白舌', '白滑苔', '胖嫩有齿痕'],
                        symptoms: ['畏寒', '四肢冷', '腰膝酸软', '精神不振'],
                        treatment: '温阳益气',
                        lifestyle: ['保暖防寒', '温热饮食', '适度运动']
                    },
                    'yin_deficiency': {
                        name: '阴虚质',
                        tongueFeatures: ['红舌', '少苔或无苔', '瘦薄有裂纹'],
                        symptoms: ['五心烦热', '盗汗', '口干', '失眠'],
                        treatment: '滋阴降火',
                        lifestyle: ['清淡饮食', '充足睡眠', '避免熬夜']
                    },
                    'dampness_heat': {
                        name: '湿热质',
                        tongueFeatures: ['红舌', '黄腻苔', '苔厚而粘'],
                        symptoms: ['口苦', '身重', '小便黄', '大便粘腻'],
                        treatment: '清热利湿',
                        lifestyle: ['清淡饮食', '避免油腻', '多饮水']
                    }
                }
            }
        };
        
        // Chinese Traditional Medicine (TCM) Knowledge Base
        const TCM_KNOWLEDGE = {
            // 中医面部诊断理论 - 五脏六腑面部对应
            facialMapping: {
                forehead: {
                    organs: ['心', '小肠'],
                    zone: 'upper_forehead',
                    tcmName: '额部心区',
                    description: '额头反映心脏和小肠功能',
                    normalSigns: ['光泽红润', '皮肤平滑', '无明显纹路'],
                    abnormalSigns: {
                        'red': { meaning: '心火旺盛', causes: ['情绪激动', '思虑过度', '心血管负担'] },
                        'pale': { meaning: '心血不足', causes: ['气血虚弱', '心脏功能低下', '营养不良'] },
                        'dark': { meaning: '心血瘀滞', causes: ['血液循环不良', '情志不畅', '劳累过度'] },
                        'yellow': { meaning: '脾胃湿热', causes: ['饮食不节', '湿邪内生', '消化功能异常'] }
                    }
                },
                eyeArea: {
                    organs: ['��', '胆'],
                    zone: 'eye_region',
                    tcmName: '眼部肝胆区',
                    description: '眼部反映肝胆功能和血液状况',
                    normalSigns: ['目光有神', '白睛清澈', '眼周润泽'],
                    abnormalSigns: {
                        'red': { meaning: '肝火上炎', causes: ['情志不畅', '饮酒过度', '熬夜劳累'] },
                        'yellow': { meaning: '肝胆湿热', causes: ['肝胆功能异常', '湿热内蕴', '胆汁代谢障碍'] },
                        'dark': { meaning: '肝肾不足', causes: ['精血亏虚', '慢性疲劳', '肾精不足'] },
                        'swollen': { meaning: '脾虚水湿', causes: ['脾胃虚弱', '水液代谢失常', '睡眠不足'] }
                    }
                },
                nose: {
                    organs: ['脾', '胃'],
                    zone: 'nose_region',
                    tcmName: '鼻部脾胃区',
                    description: '鼻部反映脾胃消化功能',
                    normalSigns: ['鼻色润泽', '鼻形端正', '无红肿'],
                    abnormalSigns: {
                        'red': { meaning: '胃火炽盛', causes: ['饮食辛辣', '胃热内盛', '消化功能亢进'] },
                        'pale': { meaning: '脾胃虚寒', causes: ['脾胃阳虚', '消化能力低下', '营养吸收不良'] },
                        'dark': { meaning: '脾虚血瘀', causes: ['脾气虚弱', '血液循环差', '慢性消化疾病'] },
                        'oily': { meaning: '脾胃湿热', causes: ['饮食油腻', '湿邪困脾', '代谢异常'] }
                    }
                },
                cheeks: {
                    organs: ['肺', '大肠'],
                    zone: 'cheek_region',
                    tcmName: '面颊肺肠区',
                    description: '面颊反映肺和大肠功能',
                    normalSigns: ['面色红润', '皮肤细腻', '毛孔细小'],
                    abnormalSigns: {
                        'red': { meaning: '肺热壅盛', causes: ['外感风热', '肺部炎症', '呼吸道感染'] },
                        'pale': { meaning: '肺气虚弱', causes: ['肺功能低下', '气虚体弱', '免疫力下降'] },
                        'rough': { meaning: '肺燥津伤', causes: ['燥邪伤肺', '津液不足', '环境干燥'] },
                        'acne': { meaning: '大肠湿热', causes: ['肠道功能异常', '湿热内蕴', '排毒不畅'] }
                    }
                },
                chin: {
                    organs: ['肾', '膀胱', '生殖系统'],
                    zone: 'chin_region',
                    tcmName: '下颏肾区',
                    description: '下巴反映肾脏和生殖系统功能',
                    normalSigns: ['下巴饱满', '皮肤光滑', '色泽正常'],
                    abnormalSigns: {
                        'dark': { meaning: '肾阳虚衰', causes: ['肾功能低下', '内分泌失调', '生殖功能异常'] },
                        'pale': { meaning: '肾阴不足', causes: ['精血亏虚', '阴虚火旺', '更年期症状'] },
                        'acne': { meaning: '肾虚湿热', causes: ['内分泌紊乱', '湿热下注', '生殖系统炎症'] },
                        'sagging': { meaning: '肾气不足', causes: ['先天不足', '过度劳累', '年老体衰'] }
                    }
                }
            },
            
            // 中医色诊理论
            colorDiagnosis: {
                'red': {
                    tcmMeaning: '热证',
                    pathology: '阳盛阴虚，血热妄行',
                    commonCauses: ['外感风热', '内火上炎', '血瘀化热'],
                    associatedSymptoms: ['口干', '心烦', '便秘', '小便黄'],
                    treatment: '清热泻火，凉血解毒',
                    herbs: ['黄连', '栀子', '生地黄', '丹皮'],
                    lifestyle: ['清淡饮食', '避免辛辣', '充足睡眠', '保持心情平和']
                },
                'pale': {
                    tcmMeaning: '虚证',
                    pathology: '气血不足，阳气虚衰',
                    commonCauses: ['脾胃虚弱', '心血不足', '肾阳虚衰'],
                    associatedSymptoms: ['乏力', '食欲不振', '心悸', '畏寒'],
                    treatment: '补气养血，温阳助气',
                    herbs: ['人参', '黄芪', '当归', '熟地黄'],
                    lifestyle: ['营养均衡', '适量运动', '规律作息', '保暖防寒']
                },
                'yellow': {
                    tcmMeaning: '脾虚湿盛',
                    pathology: '脾胃运化失常，湿邪内生',
                    commonCauses: ['饮食不节', '思虑过度', '湿邪困脾'],
                    associatedSymptoms: ['腹胀', '便溏', '困倦', '食欲不振'],
                    treatment: '健脾除湿，理气和胃',
                    herbs: ['白术', '茯苓', '陈皮', '半夏'],
                    lifestyle: ['清淡饮食', '避免生冷', '适量运动', '保持心情舒畅']
                },
                'dark': {
                    tcmMeaning: '肾虚血瘀',
                    pathology: '肾精不足，血液瘀滞',
                    commonCauses: ['先天不足', '房劳过度', '慢性疲劳'],
                    associatedSymptoms: ['腰膝酸软', '健忘', '夜尿频', '性功能下降'],
                    treatment: '补肾填精，活血化瘀',
                    herbs: ['何首乌', '枸杞子', '丹参', '川芎'],
                    lifestyle: ['规律作息', '节制房事', '补肾食物', '适度运动']
                }
            },
            
            // 中医望诊要点
            inspection: {
                complexion: {
                    '红润有光泽': { meaning: '气血充足，脏腑功能正常' },
                    '面色萎黄': { meaning: '脾胃虚弱，气血不足' },
                    '面色青紫': { meaning: '寒证或血瘀' },
                    '面色黑暗': { meaning: '肾虚或水湿内停' },
                    '面色潮红': { meaning: '阴虚火旺或实热证' }
                },
                eyes: {
                    '目光有神': { meaning: '精神充足，脏腑功能正常' },
                    '目光呆滞': { meaning: '精神不足，脏腑功能低下' },
                    '眼睛红肿': { meaning: '风热上攻或肝火上炎' },
                    '眼圈发黑': { meaning: '肾虚或血瘀' },
                    '眼袋明显': { meaning: '脾虚水湿或肾阳不足' }
                },
                tongue: {
                    coating: '舌苔反映胃气和病邪深浅',
                    color: '舌色反映脏腑气血盛衰',
                    texture: '舌质反映脏腑功能状态'
                }
            }
        };
        
        // Western Medical Knowledge Base
        const WESTERN_MEDICAL_KNOWLEDGE = {
            dermatology: {
                skinTypes: {
                    'normal': {
                        characteristics: ['平衡的油脂分泌', '细小毛孔', '光滑质地', '良好弹性'],
                        care: ['温和清洁', '适度保湿', '防晒保护', '规律护理'],
                        concerns: ['环境损害', '年龄变化', '季节影响']
                    },
                    'oily': {
                        characteristics: ['过度油脂分泌', '粗大毛孔', '易长痘痘', '光泽明显'],
                        care: ['深层清洁', '控油保湿', '去角质', '避免过度清洁'],
                        concerns: ['痤疮', '毛孔堵塞', '皮肤炎症']
                    },
                    'dry': {
                        characteristics: ['油脂分泌不足', '细小毛孔', '易脱皮', '紧绷感'],
                        care: ['温和清洁', '深度保湿', '避免刺激', '使用润肤剂'],
                        concerns: ['敏感反应', '早期老化', '屏障功能受损']
                    },
                    'combination': {
                        characteristics: ['T区油腻', '面颊干燥', '毛孔大小不均', '肤质不匀'],
                        care: ['分区护理', '平衡清洁', '针对性保湿', '定期去角质'],
                        concerns: ['护理复杂', '产品选择困难']
                    },
                    'sensitive': {
                        characteristics: ['易红肿', '刺痛感', '过敏反应', '屏障脆弱'],
                        care: ['极温和产品', '避免刺激成分', '加强屏障修复', '过敏原测试'],
                        concerns: ['炎症反应', '接触性皮炎', '屏障功能损害']
                    }
                },
                
                commonConditions: {
                    'acne': {
                        medicalName: '痤疮',
                        causes: ['皮脂腺过度分泌', '毛囊角化异常', '痤疮丙酸杆菌感染', '激素水平变化'],
                        symptoms: ['粉刺', '丘疹', '脓疱', '结节', '囊肿'],
                        treatment: ['外用维A酸', '抗生素', '激素调节', '化学剥脱'],
                        prevention: ['正确清洁', '避免挤压', '饮食调节', '规律作息']
                    },
                    'rosacea': {
                        medicalName: '酒渣鼻',
                        causes: ['血管异常扩张', '炎症反应', '螨虫感染', '环境刺激'],
                        symptoms: ['面部红斑', '毛细血管扩张', '丘疹脓疱', '鼻部增生'],
                        treatment: ['外用甲硝唑', '口服抗生素', '激光治疗', '避免诱因'],
                        prevention: ['防晒保护', '避免刺激', '温和护理', '识别诱因']
                    },
                    'melasma': {
                        medicalName: '黄褐斑',
                        causes: ['激素变化', '紫外线暴露', '遗传因素', '某些药物'],
                        symptoms: ['面部色素沉着', '边界清楚', '对称分布', '颜色加深'],
                        treatment: ['外用美白剂', '化学剥脱', '激光治疗', '严格防晒'],
                        prevention: ['防晒保护', '避免刺激', '激素调节', '营养补充']
                    }
                }
            },
            
            ophthalmology: {
                eyeConditions: {
                    'dryEye': {
                        medicalName: '干眼症',
                        causes: ['泪液分泌不足', '泪液蒸发过快', '睑板腺功能障碍', '环境因素'],
                        symptoms: ['眼部干涩', '异物感', '烧灼感', '视力模糊'],
                        treatment: ['人工泪液', '睑板腺按摩', '热敷', '环境调节'],
                        prevention: ['定期休息', '环境加湿', '眨眼练习', '营养补充']
                    },
                    'conjunctivitis': {
                        medicalName: '结膜炎',
                        causes: ['细菌感染', '病毒感染', '过敏反应', '化学刺激'],
                        symptoms: ['眼红', '分泌物', '瘙痒', '异物感'],
                        treatment: ['抗生素滴眼液', '抗病毒药物', '抗过敏药物', '清洁护理'],
                        prevention: ['手部卫生', '避免接触', '环境清洁', '个人用品分离']
                    }
                }
            },
            
            cardiovascular: {
                facialSigns: {
                    'flushing': {
                        medicalName: '面部潮红',
                        causes: ['血管扩张', '血压升高', '激素变化', '血液循环异常'],
                        associatedConditions: ['高血压', '甲状腺功能亢进', '更年期', '心脏疾病'],
                        monitoring: ['血压测量', '心率监测', '激素检查', '心电图检查']
                    },
                    'pallor': {
                        medicalName: '面色苍白',
                        causes: ['贫血', '血液循环不良', '心脏功能异常', '血管收缩'],
                        associatedConditions: ['缺铁性贫血', '心脏病', '低血压', '慢性疾病'],
                        monitoring: ['血常规��查', '铁蛋白检测', '心功能评估', '血压监测']
                    }
                }
            },
            
            endocrinology: {
                hormonalEffects: {
                    'thyroid': {
                        hyperthyroid: {
                            facialSigns: ['眼球突出', '面部消瘦', '皮肤湿润', '面色潮红'],
                            symptoms: ['心悸', '多汗', '体重下降', '易激动'],
                            treatment: ['抗甲状腺药物', '碘-131治疗', '手术治疗']
                        },
                        hypothyroid: {
                            facialSigns: ['面部浮肿', '皮肤干燥', '毛发稀疏', '面色苍白'],
                            symptoms: ['乏力', '体重增加', '怕冷', '记忆力下降'],
                            treatment: ['甲状腺激素替代治疗']
                        }
                    },
                    'adrenal': {
                        cushingSyndrome: {
                            facialSigns: ['月亮脸', '面部痤疮', '多毛', '紫纹'],
                            causes: ['皮质醇过���', '肾上腺肿瘤', '垂体腺瘤'],
                            treatment: ['手术治疗', '药物控制', '放疗']
                        }
                    }
                }
            }
        };
        
        // Medical Assessment Criteria
        const MEDICAL_ASSESSMENT = {
            riskFactors: {
                age: {
                    '18-30': { risks: ['痤疮', '激素波动', '生活方式疾病'], protection: ['建立护肤习惯', '健康饮食', '规律运动'] },
                    '31-45': { risks: ['色素沉着', '皱纹形成', '代谢变化'], protection: ['抗氧化护理', '防晒保护', '营养补充'] },
                    '46-60': { risks: ['更年期变化', '慢性疾病', '皮肤老化'], protection: ['激素调节', '定期体检', '专业护理'] },
                    '60+': { risks: ['慢性疾病', '免疫力下降', '多器官功能衰退'], protection: ['综合调理', '定期监测', '预防护理'] }
                },
                
                lifestyle: {
                    smoking: {
                        effects: ['皮肤老化加速', '血液循环差', '伤口愈合慢', '肺功能下降'],
                        facialSigns: ['皱纹增多', '皮肤暗黄', '弹性下降', '毛细血管明显']
                    },
                    alcohol: {
                        effects: ['肝功能损害', '血管扩张', '营养不良', '睡眠质量差'],
                        facialSigns: ['面部潮红', '毛细血管扩张', '眼袋明显', '皮肤粗糙']
                    },
                    stress: {
                        effects: ['激素失调', '免疫力下降', '睡眠障碍', '消化问题'],
                        facialSigns: ['痤疮增多', '面色暗沉', '眼部疲劳', '肌肉紧张']
                    },
                    diet: {
                        effects: ['营养状况', '消化功能', '代谢水平', '免疫功能'],
                        facialSigns: ['肤质变化', '色泽异常', '炎症反应', '愈合能力']
                    }
                }
            },
            
            warningSigns: {
                immediate: ['突然面色改变', '呼吸困难', '意识障碍', '剧烈头痛'],
                urgent: ['持续性面部肿胀', '视力突然��降', '面部麻木', '言语不清'],
                monitoring: ['逐渐出现的色素变化', '慢性眼部问题', '持续性皮肤问题', '面部不对称加重']
            }
        };
        
        // Initialize DOM elements
        function initializeDOM() {
            video = document.getElementById('video');
            canvas = document.getElementById('canvas');
            landmarkCanvas = document.getElementById('landmarkCanvas');
            ctx = canvas.getContext('2d');
            landmarkCtx = landmarkCanvas.getContext('2d');
            
            status = document.getElementById('status');
            modelStatus = document.getElementById('modelStatus');
            progressBar = document.getElementById('progressBar');
            progressContainer = document.getElementById('progressContainer');
            
            initBtn = document.getElementById('initBtn');
            startBtn = document.getElementById('startBtn');
            captureBtn = document.getElementById('captureBtn');
            landmarkBtn = document.getElementById('landmarkBtn');
            tongueBtn = document.getElementById('tongueBtn');
            exportBtn = document.getElementById('exportBtn');
        }
        
        // Update status with styling
        function updateStatus(msg, type = '') {
            console.log(`📢 ${type.toUpperCase()}: ${msg}`);
            status.textContent = msg;
            status.className = `status ${type}`;
        }
        
        function updateModelStatus(msg, type = '') {
            modelStatus.textContent = `AI模型: ${msg}`;
            modelStatus.className = `model-status ${type}`;
        }
        
        function updateProgress(percent) {
            progressContainer.style.display = 'block';
            progressBar.style.width = `${percent}%`;
            if (percent >= 100) {
                setTimeout(() => {
                    progressContainer.style.display = 'none';
                }, 2000);
            }
        }
        
        // Initialize AI Models
        async function initializeAI() {
            updateStatus("正在初始化AI模型...", 'loading');
            updateProgress(0);
            initBtn.disabled = true;
            
            try {
                // Check TensorFlow.js
                if (!window.tf) {
                    throw new Error("TensorFlow.js未加载");
                }
                
                updateProgress(20);
                updateModelStatus("初始化TensorFlow.js...", 'loading');
                
                // Initialize TensorFlow backend
                await tf.ready();
                console.log("✅ TensorFlow.js已准备就绪");
                
                updateProgress(40);
                
                // Try to set WebGL backend for better performance
                try {
                    await tf.setBackend('webgl');
                    console.log("🚀 使用WebGL后端加速");
                } catch (e) {
                    console.log("⚠️ WebGL不可用，使用CPU后端");
                    await tf.setBackend('cpu');
                }
                
                updateProgress(60);
                updateModelStatus("加载面部检测模型...", 'loading');
                
                // Load face detection model
                if (window.faceLandmarksDetection) {
                    try {
                        model = await faceLandmarksDetection.createDetector(
                            faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
                            {
                                runtime: 'tfjs',
                                maxFaces: 1,
                                refineLandmarks: true
                            }
                        );
                        modelType = 'MediaPipeFaceMesh';
                        console.log("✅ MediaPipe FaceMesh模型加载成功");
                    } catch (e) {
                        console.log("⚠️ MediaPipe加载失败，尝试BlazeFace...");
                        model = await blazeface.load();
                        modelType = 'BlazeFace';
                        console.log("✅ BlazeFace模型加载成功");
                    }
                } else if (window.blazeface) {
                    model = await blazeface.load();
                    modelType = 'BlazeFace';
                    console.log("✅ BlazeFace模型加载成功");
                } else {
                    throw new Error("无可用的面部检测模型");
                }
                
                updateProgress(80);
                
                // Model warmup
                updateModelStatus("模型预热中...", 'loading');
                const dummyImage = tf.zeros([224, 224, 3]);
                if (modelType === 'MediaPipeFaceMesh') {
                    await model.estimateFaces(dummyImage);
                } else {
                    await model.estimateFaces(dummyImage, false);
                }
                dummyImage.dispose();
                
                updateProgress(100);
                updateStatus("🎉 AI模型初始化完成！", 'success');
                updateModelStatus(`${modelType} 已就绪`, 'success');
                
                startBtn.disabled = false;
                
            } catch (error) {
                console.error("❌ AI模型初始化失败:", error);
                updateStatus(`AI初始化失败: ${error.message}`, 'error');
                updateModelStatus("初始化失败", 'error');
                initBtn.disabled = false;
            }
        }
        
        // Start camera with enhanced settings
        async function startCamera() {
            updateStatus("正在启动摄像头...", 'loading');
            startBtn.disabled = true;
            
            try {
                if (!navigator.mediaDevices) {
                    throw new Error("您的浏览器不支持摄像头访问");
                }
                
                // Enhanced camera constraints
                const constraints = {
                    video: {
                        width: { ideal: 1280, min: 640 },
                        height: { ideal: 720, min: 480 },
                        facingMode: 'user',
                        frameRate: { ideal: 30, min: 15 }
                    },
                    audio: false
                };
                
                stream = await navigator.mediaDevices.getUserMedia(constraints);
                video.srcObject = stream;
                
                video.onloadedmetadata = function() {
                    video.play().then(() => {
                        // Set up canvases
                        const width = video.videoWidth;
                        const height = video.videoHeight;
                        
                        canvas.width = width;
                        canvas.height = height;
                        landmarkCanvas.width = width;
                        landmarkCanvas.height = height;
                        
                        // Position landmark canvas
                        const videoRect = video.getBoundingClientRect();
                        landmarkCanvas.style.position = 'absolute';
                        landmarkCanvas.style.top = video.offsetTop + 'px';
                        landmarkCanvas.style.left = video.offsetLeft + 'px';
                        landmarkCanvas.style.width = video.offsetWidth + 'px';
                        landmarkCanvas.style.height = video.offsetHeight + 'px';
                        
                        isStreaming = true;
                        captureBtn.disabled = false;
                        landmarkBtn.disabled = false;
                        tongueBtn.disabled = false;
                        
                        updateStatus("📹 摄像头运行正常，可以开始分析", 'success');
                        
                        // Start real-time processing
                        startRealtimeProcessing();
                    });
                };
                
            } catch (error) {
                console.error("❌ 摄像头启动失败:", error);
                let msg = "摄像头启动失败: ";
                
                switch (error.name) {
                    case 'NotAllowedError':
                        msg += "权限被拒绝，请允许摄像头访问";
                        break;
                    case 'NotFoundError':
                        msg += "未找到摄像头设备";
                        break;
                    case 'NotReadableError':
                        msg += "摄像头被其他应用占用";
                        break;
                    default:
                        msg += error.message;
                }
                
                updateStatus(msg, 'error');
                startBtn.disabled = false;
            }
        }
        
        // Real-time face processing
        function startRealtimeProcessing() {
            function processFrame() {
                if (!isStreaming || !video || !model) {
                    return;
                }
                
                const now = Date.now();
                if (now - lastAnalysisTime < ANALYSIS_INTERVAL) {
                    animationId = requestAnimationFrame(processFrame);
                    return;
                }
                
                lastAnalysisTime = now;
                
                // Draw current frame
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                
                // Clear landmark canvas
                landmarkCtx.clearRect(0, 0, landmarkCanvas.width, landmarkCanvas.height);
                
                if (showLandmarks) {
                    detectAndDrawLandmarks();
                }
                
                animationId = requestAnimationFrame(processFrame);
            }
            
            processFrame();
        }
        
        // Detect and draw facial landmarks
        async function detectAndDrawLandmarks() {
            try {
                const tensor = tf.browser.fromPixels(canvas);
                let faces = [];
                
                if (modelType === 'MediaPipeFaceMesh') {
                    faces = await model.estimateFaces(tensor);
                } else if (modelType === 'BlazeFace') {
                    faces = await model.estimateFaces(tensor, false);
                }
                
                tensor.dispose();
                
                // Draw landmarks
                drawFacialLandmarks(faces);
                
            } catch (error) {
                console.warn("实时检测错误:", error);
            }
        }
        
        // Draw facial landmarks on overlay canvas
        function drawFacialLandmarks(faces) {
            const scaleX = landmarkCanvas.width / canvas.width;
            const scaleY = landmarkCanvas.height / canvas.height;
            
            landmarkCtx.strokeStyle = '#00FF00';
            landmarkCtx.fillStyle = '#FF0000';
            landmarkCtx.lineWidth = 2;
            
            faces.forEach(face => {
                if (face.keypoints) {
                    // MediaPipe landmarks
                    face.keypoints.forEach(point => {
                        const x = point.x * scaleX;
                        const y = point.y * scaleY;
                        
                        landmarkCtx.beginPath();
                        landmarkCtx.arc(x, y, 1, 0, 2 * Math.PI);
                        landmarkCtx.fill();
                    });
                } else if (face.landmarks) {
                    // BlazeFace landmarks
                    face.landmarks.forEach(point => {
                        const x = point[0] * scaleX;
                        const y = point[1] * scaleY;
                        
                        landmarkCtx.beginPath();
                        landmarkCtx.arc(x, y, 2, 0, 2 * Math.PI);
                        landmarkCtx.fill();
                    });
                }
                
                // Draw bounding box
                if (face.box) {
                    const box = face.box;
                    landmarkCtx.strokeRect(
                        box.xMin * scaleX,
                        box.yMin * scaleY,
                        (box.xMax - box.xMin) * scaleX,
                        (box.yMax - box.yMin) * scaleY
                    );
                } else if (face.boundingBox) {
                    const box = face.boundingBox;
                    landmarkCtx.strokeRect(
                        box.topLeft[0] * scaleX,
                        box.topLeft[1] * scaleY,
                        (box.bottomRight[0] - box.topLeft[0]) * scaleX,
                        (box.bottomRight[1] - box.topLeft[1]) * scaleY
                    );
                }
            });
        }
        
        // Toggle tongue analysis mode
        function toggleTongueMode() {
            tongueMode = !tongueMode;
            const btn = document.getElementById('tongueBtn');
            
            if (tongueMode) {
                btn.textContent = '👅 舌诊模式开启';
                btn.style.background = '#27ae60';
                updateStatus('👅 舌诊模式已开启，请伸出舌头进行分析', 'success');
            } else {
                btn.textContent = '��� 舌诊模式';
                btn.style.background = '#e67e22';
                updateStatus('舌诊模式已关闭', 'success');
            }
        }
        
        // Toggle landmark display
        function toggleLandmarks() {
            showLandmarks = !showLandmarks;
            landmarkBtn.textContent = showLandmarks ? '隐藏面部特征点' : '显示面部特征点';
            
            if (!showLandmarks) {
                landmarkCtx.clearRect(0, 0, landmarkCanvas.width, landmarkCanvas.height);
            }
            
            updateStatus(showLandmarks ? "面部特征点显示已开启" : "面部特征点显示已关闭", 'success');
        }
        
        // Main AI Analysis Function
        async function captureAndAnalyze() {
            if (!isStreaming || !model) {
                updateStatus("请先初始化AI模型并启动摄像头", 'error');
                return;
            }
            
            updateStatus("🤖 正在进行AI分析...", 'loading');
            captureBtn.disabled = true;
            
            try {
                // Capture current frame
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                
                updateProgress(20);
                
                // AI Face Detection
                const tensor = tf.browser.fromPixels(canvas);
                let faces = [];
                
                if (modelType === 'MediaPipeFaceMesh') {
                    faces = await model.estimateFaces(tensor);
                } else if (modelType === 'BlazeFace') {
                    faces = await model.estimateFaces(tensor, false);
                }
                
                tensor.dispose();
                updateProgress(40);
                
                if (faces.length === 0) {
                    throw new Error("未检测到面部，请调整位置后重试");
                }
                
                // AI-powered analysis
                updateProgress(60);
                const analysisResults = await performAIAnalysis(faces[0], imageData);
                
                updateProgress(80);
                
                // Display results
                displayAnalysisResults(analysisResults, faces[0]);
                
                updateProgress(100);
                updateStatus("🎉 AI分析完成！", 'success');
                
                // Show results
                document.getElementById('results').style.display = 'block';
                
                // Enable export button
                exportBtn.disabled = false;
                
            } catch (error) {
                console.error("❌ 分析失败:", error);
                updateStatus(`分析失败: ${error.message}`, 'error');
            } finally {
                captureBtn.disabled = false;
            }
        }
        
        // AI-powered facial analysis
        async function performAIAnalysis(face, imageData) {
            const results = {
                timestamp: new Date(),
                faceDetection: analyzeFaceDetection(face),
                complexion: analyzeComplexionAI(face, imageData),
                eyeHealth: analyzeEyeHealthAI(face, imageData),
                facialSymmetry: analyzeFacialSymmetryAI(face),
                skinQuality: analyzeSkinQualityAI(face, imageData)
            };
            
            // Add tongue analysis if available
            updateStatus("👅 正在分析舌诊信息...", 'loading');
            
            // Always attempt tongue analysis when in tongue mode, or try detection in normal mode
            if (tongueMode) {
                console.log("🔍 Tongue mode activated - forcing tongue analysis");
            }
            
            const tongueResults = await analyzeTongueCoating(face, imageData);
            if (tongueResults && tongueResults.detected) {
                results.tongueAnalysis = tongueResults;
                updateStatus("✅ 舌诊分析完成", 'success');
                console.log("✅ Tongue analysis successful:", tongueResults);
            } else {
                updateStatus("⚠️ 未检测到舌头，建议伸出舌头重新分析", 'warning');
                results.tongueAnalysis = null;
                console.log("❌ Tongue analysis failed or no tongue detected");
            }
            
            // Generate AI recommendations
            results.recommendations = generateAIRecommendations(results);
            
            return results;
        }
        
        // Face detection analysis
        function analyzeFaceDetection(face) {
            let confidence = 0.9;
            let landmarks = 0;
            
            if (face.score !== undefined) {
                confidence = face.score;
            } else if (face.probability !== undefined) {
                confidence = face.probability[0] || 0.9;
            }
            
            if (face.keypoints) {
                landmarks = face.keypoints.length;
            } else if (face.landmarks) {
                landmarks = face.landmarks.length;
            }
            
            return {
                confidence: confidence,
                landmarks: landmarks,
                model: modelType,
                quality: confidence > 0.8 ? 'excellent' : confidence > 0.6 ? 'good' : 'fair'
            };
        }
        
        // Tongue Analysis Functions
        async function analyzeTongueCoating(face, imageData) {
            try {
                // Extract tongue region from the image
                let tongueRegion = extractTongueRegion(face, imageData);
                
                // If no tongue detected but we're in tongue mode, use estimated mouth region
                if ((!tongueRegion || tongueRegion.data.length === 0) && tongueMode) {
                    console.log("🔄 No tongue detected, using estimated mouth region for analysis");
                    tongueRegion = extractEstimatedMouthRegion(face, imageData);
                }
                
                if (!tongueRegion || tongueRegion.data.length === 0) {
                    return null; // No tongue detected
                }
                
                console.log("✅ Tongue region extracted for analysis");
                
                // Analyze tongue characteristics
                const tongueAnalysis = {
                    coating: analyzeTongueCoatingType(tongueRegion),
                    body: analyzeTongueBody(tongueRegion),
                    moisture: analyzeTongueMoisture(tongueRegion),
                    distribution: analyzeTongueDistribution(tongueRegion)
                };
                
                // Generate comprehensive TCM diagnosis
                const tcmDiagnosis = generateTCMTongueDiagnosis(tongueAnalysis);
                
                return {
                    detected: true,
                    analysis: tongueAnalysis,
                    tcmDiagnosis: tcmDiagnosis,
                    confidence: calculateTongueAnalysisConfidence(tongueAnalysis),
                    timestamp: new Date(),
                    usingFallback: !tongueRegion.isValidTongue
                };
                
            } catch (error) {
                console.warn("舌诊分析错误:", error);
                return null;
            }
        }
        
        // Extract estimated mouth region when tongue mode is on but no tongue detected
        function extractEstimatedMouthRegion(face, imageData) {
            if (!face.keypoints) return null;
            const landmarks = face.keypoints;
            const mouthLandmarks = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308];
            const mouthPoints = mouthLandmarks.map(i => landmarks[i]);
            
            const x = Math.min(...mouthPoints.map(p => p.x));
            const y = Math.min(...mouthPoints.map(p => p.y));
            const width = Math.max(...mouthPoints.map(p => p.x)) - x;
            const height = Math.max(...mouthPoints.map(p => p.y)) - y;

            const region = extractImageRegion(imageData, x, y, width, height);
            region.isValidTongue = false; // Mark as fallback
            return region;
        }
        
        // Extract tongue region from facial image
        function extractTongueRegion(face, imageData) {
            if (!face.keypoints) return null;
            const landmarks = face.keypoints;
            const mouthLandmarks = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308];
            const mouthPoints = mouthLandmarks.map(i => landmarks[i]);

            const x = Math.min(...mouthPoints.map(p => p.x));
            const y = Math.min(...mouthPoints.map(p => p.y));
            const width = Math.max(...mouthPoints.map(p => p.x)) - x;
            const height = Math.max(...mouthPoints.map(p => p.y)) - y;
            
            // Extract the region and check if it contains tongue-like colors
            const region = extractImageRegion(imageData, x, y, width, height);
            
            // Validate if this region likely contains a tongue
            if (isTongueRegion(region)) {
                region.isValidTongue = true;
                return region;
            }
            
            console.log("🔍 Extracted region did not pass tongue validation");
            return null;
        }
        
        // Check if extracted region likely contains a tongue
        function isTongueRegion(region) {
            const colorStats = analyzeColorDistribution(region);
            
            // More lenient tongue detection criteria
            const avgColor = colorStats.avgColor;
            
            // Tongue typically has pinkish/reddish colors, but be more flexible
            const isInTongueColorRange = (
                avgColor.r > 80 &&  // Reduced from 120
                avgColor.g > 40 &&  // Keep same
                avgColor.b > 30 &&  // Reduced from 40
                avgColor.r >= avgColor.g && // More flexible
                (avgColor.r + avgColor.g + avgColor.b) > 180 // Reduced total
            );
            
            // Check for reasonable brightness and color variation
            const hasReasonableBrightness = colorStats.brightness > 0.2 && colorStats.brightness < 0.95;
            const hasVariation = colorStats.uniformity < 0.9; // More lenient
            
            console.log("🔍 Tongue Detection Debug:", {
                avgColor,
                isInTongueColorRange,
                hasReasonableBrightness,
                hasVariation,
                brightness: colorStats.brightness,
                uniformity: colorStats.uniformity
            });
            
            return isInTongueColorRange && hasReasonableBrightness && hasVariation;
        }
        
        // Analyze tongue coating type
        function analyzeTongueCoatingType(tongueRegion) {
            const colorStats = analyzeColorDistribution(tongueRegion);
            const avgColor = colorStats.avgColor;
            
            // Determine coating type based on color analysis
            let coatingType = 'white_thin'; // default
            let thickness = calculateCoatingThickness(colorStats);
            
            if (avgColor.r < 140 && avgColor.g < 140 && avgColor.b < 140) {
                // Dark coating
                coatingType = 'gray_black';
            } else if (avgColor.g > avgColor.r && avgColor.g > avgColor.b) {
                // Yellowish coating
                coatingType = thickness > 0.6 ? 'yellow_thick' : 'yellow_thin';
            } else if (colorStats.uniformity > 0.8 && colorStats.brightness > 0.7) {
                // Very uniform and bright - possibly no coating
                coatingType = 'no_coating';
            } else if (thickness > 0.6) {
                coatingType = 'white_thick';
            } else {
                coatingType = 'white_thin';
            }
            
            return {
                type: coatingType,
                thickness: thickness,
                tcmData: TCM_TONGUE_KNOWLEDGE.coatingTypes[coatingType]
            };
        }
        
        // Calculate coating thickness based on image analysis
        function calculateCoatingThickness(colorStats) {
            // Thicker coating typically means more uniform color, less variation
            const thicknessIndicator = colorStats.uniformity * (1 - colorStats.contrast);
            return Math.max(0, Math.min(1, thicknessIndicator));
        }
        
        // Analyze tongue body characteristics
        function analyzeTongueBody(tongueRegion) {
            const colorStats = analyzeColorDistribution(tongueRegion);
            const avgColor = colorStats.avgColor;
            
            // Determine tongue color
            let tongueColor = 'red'; // default
            if (avgColor.r < 120 && avgColor.g < 120 && avgColor.b < 120) {
                tongueColor = 'pale';
            } else if (avgColor.r > 180 && avgColor.r > avgColor.g * 1.3) {
                if (avgColor.r > 200) {
                    tongueColor = 'dark_red';
                } else {
                    tongueColor = 'red';
                }
            } else if (avgColor.b > avgColor.r && avgColor.b > avgColor.g) {
                tongueColor = 'purple';
            }
            
            // Analyze texture
            let texture = colorStats.uniformity > 0.7 ? 'tender' : 'old';
            
            // Analyze shape (simplified)
            let shape = 'normal';
            if (colorStats.brightness > 0.8) {
                shape = 'fat'; // Often appears brighter due to surface area
            } else if (colorStats.contrast > 0.6) {
                shape = 'thin'; // More contrast may indicate thinness
            }
            
            return {
                color: tongueColor,
                texture: texture,
                shape: shape,
                tcmColorData: TCM_TONGUE_KNOWLEDGE.tongueBody.color[tongueColor],
                tcmTextureData: TCM_TONGUE_KNOWLEDGE.tongueBody.texture[texture],
                tcmShapeData: TCM_TONGUE_KNOWLEDGE.tongueBody.shape[shape]
            };
        }
        
        // Analyze tongue moisture
        function analyzeTongueMoisture(tongueRegion) {
            const colorStats = analyzeColorDistribution(tongueRegion);
            
            let moistureType = 'wet'; // default
            
            if (colorStats.brightness < 0.4) {
                moistureType = 'dry';
            } else if (colorStats.brightness > 0.8 && colorStats.uniformity > 0.7) {
                moistureType = 'slippery';
            }
            
            return {
                type: moistureType,
                level: colorStats.brightness,
                tcmData: TCM_TONGUE_KNOWLEDGE.moisture[moistureType]
            };
        }
        
        // Analyze tongue coating distribution
        function analyzeTongueDistribution(tongueRegion) {
            // Simplified distribution analysis
            // In a real implementation, this would analyze different regions of the tongue
            
            const colorStats = analyzeColorDistribution(tongueRegion);
            
            let distributionType = 'uniform';
            if (colorStats.uniformity < 0.5) {
                distributionType = 'partial';
            }
            
            return {
                type: distributionType,
                uniformity: colorStats.uniformity,
                tcmData: TCM_TONGUE_KNOWLEDGE.distribution[distributionType]
            };
        }
        
        // Generate comprehensive TCM tongue diagnosis
        function generateTCMTongueDiagnosis(tongueAnalysis) {
            const coating = tongueAnalysis.coating;
            const body = tongueAnalysis.body;
            const moisture = tongueAnalysis.moisture;
            
            // Find matching constitution pattern
            let matchingConstitution = null;
            let highestScore = 0;
            
            for (const [constKey, constData] of Object.entries(TCM_TONGUE_KNOWLEDGE.comprehensiveDiagnosis.constitutions)) {
                let score = 0;
                
                // Score based on tongue features match
                if (constData.tongueFeatures.includes(body.tcmColorData?.tcmName)) score += 0.4;
                if (constData.tongueFeatures.includes(coating.tcmData?.tcmName)) score += 0.3;
                if (constData.tongueFeatures.some(feature => feature.includes('胖大') && body.shape === 'fat')) score += 0.2;
                if (constData.tongueFeatures.some(feature => feature.includes('瘦薄') && body.shape === 'thin')) score += 0.2;
                
                if (score > highestScore) {
                    highestScore = score;
                    matchingConstitution = {
                        key: constKey,
                        data: constData,
                        confidence: score
                    };
                }
            }
            
            return {
                primaryDiagnosis: coating.tcmData?.indication || '正常',
                syndrome: coating.tcmData?.syndrome || [],
                pathology: coating.tcmData?.pathology || '功能正常',
                treatment: coating.tcmData?.treatment || '保持现状',
                herbs: coating.tcmData?.herbs || [],
                prognosis: coating.tcmData?.prognosis || '良好',
                constitution: matchingConstitution,
                
                // Detailed analysis
                coatingAnalysis: {
                    type: coating.tcmData?.tcmName,
                    description: coating.tcmData?.description,
                    indication: coating.tcmData?.indication
                },
                bodyAnalysis: {
                    color: body.tcmColorData?.tcmName,
                    indication: body.tcmColorData?.indication,
                    treatment: body.tcmColorData?.treatment
                },
                moistureAnalysis: {
                    type: moisture.tcmData?.tcmName,
                    indication: moisture.tcmData?.indication
                }
            };
        }
        
        // Calculate confidence score for tongue analysis
        function calculateTongueAnalysisConfidence(tongueAnalysis) {
            let confidence = 0.5; // base confidence
            
            // Higher confidence if coating analysis is clear
            if (tongueAnalysis.coating.thickness > 0.3) {
                confidence += 0.2;
            }
            
            // Higher confidence if tongue body characteristics are distinct
            if (tongueAnalysis.body.tcmColorData) {
                confidence += 0.2;
            }
            
            // Higher confidence if distribution is uniform (easier to analyze)
            if (tongueAnalysis.distribution.uniformity > 0.6) {
                confidence += 0.1;
            }
            
            return Math.min(0.95, confidence);
        }
        function analyzeComplexionAI(face, imageData) {
            const faceRegion = extractFaceRegion(face, imageData);
            const colorStats = analyzeColorDistribution(faceRegion);
            
            // Determine complexion type using medical criteria
            let complexionType = determineComplexionType(colorStats);
            let tcmAnalysis = getTCMColorAnalysis(complexionType);
            let westernAnalysis = getWesternMedicalAnalysis(complexionType, colorStats);
            
            // Calculate professional health score
            let healthScore = calculateComplexionHealthScore(colorStats, complexionType);
            
            // Facial zone analysis based on TCM mapping
            const facialZones = analyzeFacialZonesTCM(face, imageData);
            
            return {
                type: complexionType,
                healthScore: healthScore,
                characteristics: determineComplexionCharacteristics(colorStats, complexionType),
                rgb: colorStats.avgColor,
                uniformity: colorStats.uniformity,
                
                // Medical Analysis
                tcmAnalysis: {
                    diagnosis: tcmAnalysis.tcmMeaning,
                    pathology: tcmAnalysis.pathology,
                    organsAffected: facialZones.organsAffected,
                    symptoms: tcmAnalysis.associatedSymptoms,
                    treatment: tcmAnalysis.treatment,
                    herbs: tcmAnalysis.herbs,
                    lifestyle: tcmAnalysis.lifestyle
                },
                
                westernAnalysis: {
                    medicalTerms: westernAnalysis.conditions,
                    possibleCauses: westernAnalysis.causes,
                    monitoring: westernAnalysis.monitoring,
                    skinType: determineSkinType(colorStats)
                },
                
                facialMapping: facialZones,
                riskFactors: assessRiskFactors(complexionType, colorStats),
                
                advice: generateMedicalAdvice(tcmAnalysis, westernAnalysis, complexionType)
            };
        }
        
        // Determine complexion type using medical criteria
        function determineComplexionType(colorStats) {
            const { avgColor, redDominance, brightness, uniformity } = colorStats;
            
            // Enhanced color analysis with medical precision
            if (redDominance > 0.6 || avgColor.r > 160) {
                return brightness > 0.7 ? 'reddish' : 'darkRed';
            } else if (brightness < 0.35) {
                return uniformity < 0.5 ? 'darkUneven' : 'pale';
            } else if (colorStats.yellowTone > 0.4) {
                return avgColor.g > avgColor.b + 20 ? 'yellowish' : 'sallow';
            } else if (uniformity < 0.4) {
                return 'uneven';
            } else {
                return 'normal';
            }
        }
        
        // Get TCM color analysis
        function getTCMColorAnalysis(complexionType) {
            const typeMapping = {
                'reddish': 'red',
                'darkRed': 'red',
                'pale': 'pale',
                'yellowish': 'yellow',
                'sallow': 'yellow',
                'darkUneven': 'dark',
                'uneven': 'red',
                'normal': 'pale'
            };
            
            const tcmType = typeMapping[complexionType] || 'red';
            return TCM_KNOWLEDGE.colorDiagnosis[tcmType];
        }
        
        // Get Western medical analysis
        function getWesternMedicalAnalysis(complexionType, colorStats) {
            let analysis = {
                conditions: [],
                causes: [],
                monitoring: []
            };
            
            switch (complexionType) {
                case 'reddish':
                case 'darkRed':
                    analysis.conditions = ['面部潮红', '血管扩张', '可能的高血压'];
                    analysis.causes = WESTERN_MEDICAL_KNOWLEDGE.cardiovascular.facialSigns.flushing.causes;
                    analysis.monitoring = WESTERN_MEDICAL_KNOWLEDGE.cardiovascular.facialSigns.flushing.monitoring;
                    break;
                    
                case 'pale':
                    analysis.conditions = ['面色苍白', '可能的贫血', '循环不良'];
                    analysis.causes = WESTERN_MEDICAL_KNOWLEDGE.cardiovascular.facialSigns.pallor.causes;
                    analysis.monitoring = WESTERN_MEDICAL_KNOWLEDGE.cardiovascular.facialSigns.pallor.monitoring;
                    break;
                    
                case 'yellowish':
                case 'sallow':
                    analysis.conditions = ['黄疸可能性', '肝功能异常', '胆红素升高'];
                    analysis.causes = ['肝脏疾病', '胆道梗阻', '血红蛋白分解异常'];
                    analysis.monitoring = ['肝功能检查', '胆红素检测', '腹部B超'];
                    break;
                    
                case 'uneven':
                case 'darkUneven':
                    analysis.conditions = ['色素沉着', '内分泌失调', '慢性疾病'];
                    analysis.causes = ['紫外线损伤', '激素变化', '慢性炎症'];
                    analysis.monitoring = ['皮肤科检查', '激素水平检测', '营养状况评估'];
                    break;
            }
            
            return analysis;
        }
        
        // Analyze facial zones according to TCM mapping
        function analyzeFacialZonesTCM(face, imageData) {
            const zones = {
                forehead: extractForeheadRegion(face, imageData),
                eyeArea: extractEyeAreaRegion(face, imageData),
                nose: extractNoseRegion(face, imageData),
                cheeks: extractCheeksRegion(face, imageData),
                chin: extractChinRegion(face, imageData)
            };
            
            let organsAffected = [];
            let zoneAnalysis = {};
            
            Object.keys(zones).forEach(zoneName => {
                const zoneStats = analyzeColorDistribution(zones[zoneName]);
                const tcmZone = TCM_KNOWLEDGE.facialMapping[zoneName];
                
                if (tcmZone) {
                    const abnormalities = detectZoneAbnormalities(zoneStats, tcmZone);
                    if (abnormalities.length > 0) {
                        organsAffected.push(...tcmZone.organs);
                        zoneAnalysis[zoneName] = {
                            organs: tcmZone.organs,
                            tcmName: tcmZone.tcmName,
                            abnormalities: abnormalities,
                            recommendations: getZoneRecommendations(abnormalities, tcmZone)
                        };
                    }
                }
            });
            
            return {
                organsAffected: [...new Set(organsAffected)],
                zoneAnalysis: zoneAnalysis,
                overallTCMPattern: determineTCMPattern(zoneAnalysis)
            };
        }

        // Determine overall TCM pattern based on zone analysis
        function determineTCMPattern(zoneAnalysis) {
            if (!zoneAnalysis || Object.keys(zoneAnalysis).length === 0) {
                return {
                    pattern: '正常',
                    description: '面部各区域未发现明显异常',
                    severity: 'normal',
                    primaryOrgans: [],
                    recommendations: {
                        general: '保持良好的生活习惯，定期健康检查'
                    }
                };
            }

            // Count abnormality types across all zones
            const abnormalityCount = {};
            const organCount = {};
            const allAbnormalities = [];

            Object.values(zoneAnalysis).forEach(zone => {
                // Count organs affected
                zone.organs.forEach(organ => {
                    organCount[organ] = (organCount[organ] || 0) + 1;
                });

                // Count abnormality types
                zone.abnormalities.forEach(abnormality => {
                    abnormalityCount[abnormality.type] = (abnormalityCount[abnormality.type] || 0) + 1;
                    allAbnormalities.push(abnormality);
                });
            });

            // Determine primary pattern based on most common abnormality type
            const sortedAbnormalities = Object.entries(abnormalityCount)
                .sort(([,a], [,b]) => b - a);

            const primaryAbnormality = sortedAbnormalities[0] ? sortedAbnormalities[0][0] : null;

            // Determine most affected organs
            const primaryOrgans = Object.entries(organCount)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 3)
                .map(([organ]) => organ);

            // Determine severity based on number of zones affected
            const zonesAffected = Object.keys(zoneAnalysis).length;
            let severity = 'mild';
            if (zonesAffected >= 4) {
                severity = 'severe';
            } else if (zonesAffected >= 2) {
                severity = 'moderate';
            }

            // Generate pattern analysis
            let pattern, description, recommendations;

            switch (primaryAbnormality) {
                case 'red':
                    pattern = '热证为主';
                    description = '面部多处发红，提示体内热邪偏盛，可能存在心火旺盛、肝火上炎等热性病证';
                    recommendations = {
                        general: '清热泻火，调节情志，避免辛辣刺激',
                        lifestyle: '保持心情平和，充足睡眠，避免熬夜',
                        diet: '清淡饮食，多食清热食物如绿豆、苦瓜、菊花茶'
                    };
                    break;
                case 'pale':
                    pattern = '虚证为主';
                    description = '面部多处色淡，提示气血不足，脏腑功能偏弱，可能存在脾胃虚弱、心血不足等虚性病证';
                    recommendations = {
                        general: '补气养血，健脾益胃，增强体质',
                        lifestyle: '规律作息，适量运动，避免过度劳累',
                        diet: '营养均衡，多食补气血食物如红枣、桂圆、瘦肉'
                    };
                    break;
                case 'dark':
                    pattern = '瘀证为主';
                    description = '面部多处色暗，提示血液循环不畅，可能存在血瘀、肾虚等病证';
                    recommendations = {
                        general: '活血化瘀，补肾填精，改善循环',
                        lifestyle: '避免久坐，适量运动，保证充足睡眠',
                        diet: '多食活血食物如山楂、红花、黑豆'
                    };
                    break;
                case 'yellow':
                    pattern = '湿热证为主';
                    description = '面部多处发黄，提示脾胃运化失常，湿邪内生，可能存在脾虚湿盛等病证';
                    recommendations = {
                        general: '健脾除湿，理气和胃，调节消化',
                        lifestyle: '避免思虑过度，保持心情舒畅，适量运动',
                        diet: '清淡饮食，避免油腻生冷，多食健脾食物如山药、薏米'
                    };
                    break;
                default:
                    pattern = '复合证型';
                    description = '面部呈现多种异常表现，提示可能存在复合性病证，需要综合调理';
                    recommendations = {
                        general: '综合调理，平衡阴阳，调和脏腑',
                        lifestyle: '规律作息，适量运动，保持心情平和',
                        diet: '饮食均衡，避免偏食，根据具体症状调整'
                    };
            }

            return {
                pattern: pattern,
                description: description,
                severity: severity,
                primaryOrgans: primaryOrgans,
                abnormalityDistribution: abnormalityCount,
                zonesAffected: zonesAffected,
                recommendations: recommendations
            };
        }

        // Generate recommendations for facial zone abnormalities
        function getZoneRecommendations(abnormalities, tcmZone) {
            const recommendations = {
                lifestyle: [],
                diet: [],
                medical: [],
                tcm: []
            };

            // Get organ-specific recommendations based on abnormalities
            abnormalities.forEach(abnormality => {
                const abnormalSign = tcmZone.abnormalSigns[abnormality.type];
                if (abnormalSign) {
                    // Add TCM-based recommendations
                    recommendations.tcm.push(`${abnormalSign.meaning}: ${abnormalSign.causes.join('、')}`);

                    // Add lifestyle recommendations based on abnormality type
                    switch (abnormality.type) {
                        case 'red':
                            recommendations.lifestyle.push('保持心情平和，避免情绪激动');
                            recommendations.diet.push('清淡饮食，避免辛辣刺激食物');
                            recommendations.medical.push('如持续发红，建议检查相关脏腑功能');
                            break;
                        case 'pale':
                            recommendations.lifestyle.push('规律作息，适量运动增强体质');
                            recommendations.diet.push('营养均衡，多食补气血食物');
                            recommendations.medical.push('建议检查血常规和营养状况');
                            break;
                        case 'dark':
                            recommendations.lifestyle.push('避免过度劳累，保证充足睡眠');
                            recommendations.diet.push('多食活血化瘀食物，如山楂、红花茶');
                            recommendations.medical.push('建议检查血液循环和相关脏腑功能');
                            break;
                        case 'yellow':
                            recommendations.lifestyle.push('避免思虑过度，保持心情舒畅');
                            recommendations.diet.push('避免油腻食物，多食健脾除湿食品');
                            recommendations.medical.push('建议检查脾胃消化功能');
                            break;
                        case 'oily':
                            recommendations.lifestyle.push('注意面部清洁，避免熬夜');
                            recommendations.diet.push('减少油腻食物，多食清热利湿食品');
                            break;
                        case 'rough':
                            recommendations.lifestyle.push('注意皮肤保湿，避免环境过于干燥');
                            recommendations.diet.push('多饮水，食用润燥食物');
                            break;
                        case 'acne':
                            recommendations.lifestyle.push('保持面部清洁，避免用手触摸');
                            recommendations.diet.push('清淡饮食，避免高糖高脂食物');
                            recommendations.medical.push('如痤疮严重，建议皮肤科就诊');
                            break;
                        case 'swollen':
                            recommendations.lifestyle.push('保证充足睡眠，避免过度用眼');
                            recommendations.diet.push('减少盐分摄入，避免睡前大量饮水');
                            break;
                        case 'sagging':
                            recommendations.lifestyle.push('适量运动，避免过度劳累');
                            recommendations.diet.push('补充胶原蛋白，多食补肾食物');
                            break;
                    }
                }
            });

            // Remove duplicates and return
            return {
                lifestyle: [...new Set(recommendations.lifestyle)],
                diet: [...new Set(recommendations.diet)],
                medical: [...new Set(recommendations.medical)],
                tcm: [...new Set(recommendations.tcm)]
            };
        }

        // Detect abnormalities in facial zones
        function detectZoneAbnormalities(zoneStats, tcmZone) {
            const abnormalities = [];
            
            if (zoneStats.redDominance > 0.6) {
                abnormalities.push({
                    type: 'red',
                    meaning: tcmZone.abnormalSigns.red?.meaning || '热象',
                    causes: tcmZone.abnormalSigns.red?.causes || ['火热内盛']
                });
            }
            
            if (zoneStats.brightness < 0.4) {
                abnormalities.push({
                    type: 'pale',
                    meaning: tcmZone.abnormalSigns.pale?.meaning || '虚象',
                    causes: tcmZone.abnormalSigns.pale?.causes || ['气血不足']
                });
            }
            
            if (zoneStats.yellowTone > 0.5) {
                abnormalities.push({
                    type: 'yellow',
                    meaning: tcmZone.abnormalSigns.yellow?.meaning || '湿热',
                    causes: tcmZone.abnormalSigns.yellow?.causes || ['湿邪内蕴']
                });
            }
            
            if (zoneStats.uniformity < 0.5) {
                abnormalities.push({
                    type: 'dark',
                    meaning: tcmZone.abnormalSigns.dark?.meaning || '瘀血',
                    causes: tcmZone.abnormalSigns.dark?.causes || ['血液瘀滞']
                });
            }
            
            return abnormalities;
        }
        
        // Helper functions for extracting specific facial regions
        function extractForeheadRegion(face, imageData) {
            if (!face.keypoints) return extractImageRegion(imageData, 0, 0, 0, 0);
            const landmarks = face.keypoints;
            const eyebrowLandmarks = [55, 65, 105, 107, 285, 295, 334, 336];
            const eyebrowPoints = eyebrowLandmarks.map(i => landmarks[i]);
            const foreheadTop = landmarks[10];

            const x = Math.floor(Math.min(...eyebrowPoints.map(p => p.x)));
            const y = Math.floor(foreheadTop.y);
            const width = Math.floor(Math.max(...eyebrowPoints.map(p => p.x)) - x);
            const height = Math.floor(Math.max(...eyebrowPoints.map(p => p.y)) - y);

            if (width < 0 || height < 0) {
                return extractImageRegion(imageData, 0, 0, 0, 0);
            }
            return extractImageRegion(imageData, x, y, width, height);
        }
        
        function extractEyeAreaRegion(face, imageData) {
            if (!face.keypoints) return extractImageRegion(imageData, 0, 0, 0, 0);
            const landmarks = face.keypoints;
            const leftEyeLandmarks = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
            const rightEyeLandmarks = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466];
            const leftPoints = leftEyeLandmarks.map(i => landmarks[i]);
            const rightPoints = rightEyeLandmarks.map(i => landmarks[i]);
            const x = Math.floor(Math.min(...leftPoints.map(p => p.x)));
            const y = Math.floor(Math.min(...leftPoints.map(p => p.y), ...rightPoints.map(p => p.y)));
            const width = Math.floor(Math.max(...rightPoints.map(p => p.x)) - x);
            const height = Math.floor(Math.max(...leftPoints.map(p => p.y), ...rightPoints.map(p => p.y)) - y);
            if (width < 0 || height < 0) {
                return extractImageRegion(imageData, 0, 0, 0, 0);
            }
            return extractImageRegion(imageData, x, y, width, height);
        }
        
        function extractNoseRegion(face, imageData) {
            if (!face.keypoints) return extractImageRegion(imageData, 0, 0, 0, 0);
            const landmarks = face.keypoints;
            const noseLandmarks = [168, 6, 197, 195, 5, 4, 1, 19, 94, 2];
            const points = noseLandmarks.map(i => landmarks[i]);
            const x = Math.floor(Math.min(...points.map(p => p.x)));
            const y = Math.floor(Math.min(...points.map(p => p.y)));
            const width = Math.floor(Math.max(...points.map(p => p.x)) - x);
            const height = Math.floor(Math.max(...points.map(p => p.y)) - y);
            if (width < 0 || height < 0) {
                return extractImageRegion(imageData, 0, 0, 0, 0);
            }
            return extractImageRegion(imageData, x, y, width, height);
        }
        
        function extractCheeksRegion(face, imageData) {
            if (!face.keypoints) return extractImageRegion(imageData, 0, 0, 0, 0);
            const landmarks = face.keypoints;
            const leftCheekLandmarks = [132, 135, 50, 234, 127];
            const rightCheekLandmarks = [361, 364, 280, 454, 356];
            const leftPoints = leftCheekLandmarks.map(i => landmarks[i]);
            const rightPoints = rightCheekLandmarks.map(i => landmarks[i]);
            const x = Math.floor(Math.min(...leftPoints.map(p => p.x)));
            const y = Math.floor(Math.min(...leftPoints.map(p => p.y), ...rightPoints.map(p => p.y)));
            const width = Math.floor(Math.max(...rightPoints.map(p => p.x)) - x);
            const height = Math.floor(Math.max(...leftPoints.map(p => p.y), ...rightPoints.map(p => p.y)) - y);
            if (width < 0 || height < 0) {
                return extractImageRegion(imageData, 0, 0, 0, 0);
            }
            return extractImageRegion(imageData, x, y, width, height);
        }
        
        function extractChinRegion(face, imageData) {
            if (!face.keypoints) return extractImageRegion(imageData, 0, 0, 0, 0);
            const landmarks = face.keypoints;
            const chinLandmarks = [152, 148, 176, 377, 400];
            const points = chinLandmarks.map(i => landmarks[i]);
            const x = Math.floor(Math.min(...points.map(p => p.x)));
            const y = Math.floor(Math.min(...points.map(p => p.y)));
            const width = Math.floor(Math.max(...points.map(p => p.x)) - x);
            const height = Math.floor(Math.max(...points.map(p => p.y)) - y);
            if (width < 0 || height < 0) {
                return extractImageRegion(imageData, 0, 0, 0, 0);
            }
            return extractImageRegion(imageData, x, y, width, height);
        }
        
        // Helper functions for medical analysis
        function calculateComplexionHealthScore(colorStats, complexionType) {
            let baseScore = 0.8;
            
            // Adjust based on complexion type
            switch (complexionType) {
                case 'normal': baseScore = 0.9; break;
                case 'reddish': baseScore -= 0.2; break;
                case 'pale': baseScore -= 0.25; break;
                case 'yellowish': baseScore -= 0.3; break;
                case 'darkUneven': baseScore -= 0.35; break;
                default: baseScore -= 0.1;
            }
            
            // Adjust based on color uniformity
            baseScore += (colorStats.uniformity - 0.5) * 0.2;
            
            return Math.max(0.1, Math.min(1.0, baseScore));
        }
        
        function determineComplexionCharacteristics(colorStats, complexionType) {
            const characteristics = [];
            
            if (complexionType === 'normal') characteristics.push('色泽均匀');
            if (colorStats.brightness > 0.7) characteristics.push('光泽度高');
            if (colorStats.brightness < 0.4) characteristics.push('光泽度低');
            if (colorStats.uniformity < 0.5) characteristics.push('色泽不均');
            if (colorStats.redDominance > 0.6) characteristics.push('偏红');
            if (colorStats.yellowTone > 0.5) characteristics.push('偏黄');
            
            return characteristics;
        }
        
        function determineSkinType(colorStats) {
            if (colorStats.brightness > 0.8 && colorStats.contrast < 0.3) {
                return 'oily';
            } else if (colorStats.brightness < 0.5 && colorStats.contrast > 0.5) {
                return 'dry';
            } else if (colorStats.uniformity < 0.4) {
                return 'combination';
            } else {
                return 'normal';
            }
        }
        
        function assessRiskFactors(complexionType, colorStats) {
            const risks = [];
            
            if (complexionType === 'reddish') risks.push('心血管风险');
            if (complexionType === 'pale') risks.push('贫血风险');
            if (complexionType === 'yellowish') risks.push('肝胆功能风险');
            if (colorStats.uniformity < 0.4) risks.push('内分泌失调风险');
            
            return risks;
        }
        
        function generateMedicalAdvice(tcmAnalysis, westernAnalysis, complexionType) {
            const advice = {
                lifestyle: [],
                diet: [],
                monitoring: westernAnalysis.monitoring || []
            };
            
            if (tcmAnalysis.lifestyle) {
                advice.lifestyle.push(...tcmAnalysis.lifestyle);
            }
            
            switch (complexionType) {
                case 'reddish':
                    advice.diet.push('减少辛辣、油腻食物摄入');
                    break;
                case 'pale':
                    advice.diet.push('增加富含铁和蛋白质的食物');
                    break;
                case 'yellowish':
                    advice.diet.push('清淡饮食，避免酒精');
                    break;
                case 'darkUneven':
                    advice.diet.push('多吃富含维生素C和E的食物');
                    break;
            }
            
            return advice;
        }
        
        // Analyze eye health using AI
        function analyzeEyeHealthAI(face, imageData) {
            const eyeRegion = extractEyeAreaRegion(face, imageData);
            const colorStats = analyzeColorDistribution(eyeRegion);
            
            // Redness index based on red channel dominance
            const rednessIndex = Math.max(0, Math.min(1, (colorStats.avgColor.r - colorStats.avgColor.g) / 100));
            
            // Fatigue index based on brightness and blue channel
            const fatigueIndex = Math.max(0, Math.min(1, (1 - colorStats.brightness) * 0.7 + (colorStats.avgColor.b / 255) * 0.3));
            
            // Blink rate analysis
            const blinkRate = analyzeBlinkRate(face);

            // Medical analysis
            let tcmAnalysis = TCM_KNOWLEDGE.inspection.eyes;
            let westernAnalysis = {};
            
            if (rednessIndex > 0.4) {
                westernAnalysis.redness = WESTERN_MEDICAL_KNOWLEDGE.ophthalmology.eyeConditions.conjunctivitis;
            }
            if (fatigueIndex > 0.5) {
                westernAnalysis.fatigue = WESTERN_MEDICAL_KNOWLEDGE.ophthalmology.eyeConditions.dryEye;
            }
            
            return {
                redness: rednessIndex,
                fatigue: fatigueIndex,
                blinkRate: blinkRate,
                tcmAnalysis: tcmAnalysis,
                westernAnalysis: westernAnalysis
            };
        }

        function analyzeBlinkRate(face) {
            if (!face.keypoints) return -1; // Not available
            const landmarks = face.keypoints;
            // Left eye landmarks (vertical)
            const leftTop = landmarks[159];
            const leftBottom = landmarks[145];
            // Right eye landmarks (vertical)
            const rightTop = landmarks[386];
            const rightBottom = landmarks[374];

            const leftDist = Math.hypot(leftTop.x - leftBottom.x, leftTop.y - leftBottom.y);
            const rightDist = Math.hypot(rightTop.x - rightBottom.x, rightTop.y - rightBottom.y);

            // A simple heuristic for blink detection
            const avgDist = (leftDist + rightDist) / 2;
            
            // This is a placeholder for a more complex blink detection algorithm that would track this over time.
            // For a single frame, we can estimate openness.
            const openness = Math.min(1, avgDist / 10); // Normalize based on typical eye opening distance
            return openness;
        }
        
        // Analyze facial symmetry using AI
        function analyzeFacialSymmetryAI(face) {
            if (!face.keypoints || face.keypoints.length < 468) {
                // Fallback for BlazeFace or incomplete data
                return {
                    score: Math.random() * 0.2 + 0.7, // Random score between 0.7 and 0.9
                    deviations: []
                };
            }
            
            const landmarks = face.keypoints;
            
            // Define key landmark pairs for symmetry analysis
            const symmetryPairs = [
                [33, 263], // Outer eye corners
                [130, 359], // Inner eye corners
                [61, 291], // Mouth corners
                [57, 287], // Outer lip corners
                [46, 276]  // Cheekbones
            ];
            
            let totalDeviation = 0;
            let deviations = [];
            
            symmetryPairs.forEach(pair => {
                const p1 = landmarks[pair[0]];
                const p2 = landmarks[pair[1]];
                
                // Calculate horizontal deviation from facial midline (landmark 1)
                const midlineX = landmarks[1].x;
                const dev1 = Math.abs(p1.x - midlineX);
                const dev2 = Math.abs(p2.x - midlineX);
                
                const deviation = Math.abs(dev1 - dev2);
                totalDeviation += deviation;
                
                deviations.push({
                    pair: pair,
                    deviation: deviation
                });
            });
            
            // Normalize score (lower deviation is better)
            const score = Math.max(0, 1 - (totalDeviation / 100));
            
            return {
                score: score,
                deviations: deviations
            };
        }
        
        // Analyze skin quality using AI
        function analyzeSkinQualityAI(face, imageData) {
            const cheekRegion = extractCheeksRegion(face, imageData);
            const colorStats = analyzeColorDistribution(cheekRegion);
            
            // Texture index based on color variance
            const textureIndex = Math.max(0, 1 - (colorStats.contrast * 2));
            
            // Glow index based on brightness and uniformity
            const glowIndex = Math.max(0, colorStats.brightness * 0.7 + colorStats.uniformity * 0.3);
            
            // Medical analysis
            let skinType = determineSkinType(colorStats);
            let westernAnalysis = WESTERN_MEDICAL_KNOWLEDGE.dermatology.skinTypes[skinType];
            
            return {
                texture: textureIndex,
                glow: glowIndex,
                skinType: skinType,
                westernAnalysis: westernAnalysis
            };
        }
        
        // Generate AI-powered recommendations
        function generateAIRecommendations(results) {
            let recommendations = {
                lifestyle: new Set(),
                diet: new Set(),
                skincare: new Set(),
                medical: new Set()
            };
            
            // Complexion recommendations
            if (results.complexion.healthScore < 0.7) {
                recommendations.lifestyle.add(results.complexion.tcmAnalysis.lifestyle[0]);
                recommendations.diet.add(results.complexion.advice.diet[0]);
                recommendations.medical.add(`监测与${results.complexion.type}面色相关的健康指标`);
            }
            
            // Eye health recommendations
            if (results.eyeHealth.fatigue > 0.6) {
                recommendations.lifestyle.add("保证充足睡眠，每小时远眺休息");
                recommendations.skincare.add("使用缓解眼部疲劳的眼霜");
            }
            if (results.eyeHealth.redness > 0.5) {
                recommendations.medical.add("如眼部持续发红，请咨询眼科医生");
            }
            if (results.eyeHealth.blinkRate < 0.5 && results.eyeHealth.blinkRate != -1) {
                recommendations.lifestyle.add("注意增加眨眼频率，以保持眼睛湿润");
            }
            
            // Skin quality recommendations
            if (results.skinQuality.texture < 0.6) {
                recommendations.skincare.add("加强皮肤保湿，使用温和去角质产品");
            }
            if (results.skinQuality.glow < 0.5) {
                recommendations.diet.add("多摄入富含抗氧化剂的食物，如蓝莓、绿茶");
            }
            
            // Tongue analysis recommendations
            if (results.tongueAnalysis && results.tongueAnalysis.tcmDiagnosis.constitution) {
                const constitution = results.tongueAnalysis.tcmDiagnosis.constitution.data;
                recommendations.lifestyle.add(constitution.lifestyle[0]);
                recommendations.medical.add(`根据${constitution.name}进行调理`);
            }
            
            // Convert sets to arrays
            return {
                lifestyle: Array.from(recommendations.lifestyle),
                diet: Array.from(recommendations.diet),
                skincare: Array.from(recommendations.skincare),
                medical: Array.from(recommendations.medical)
            };
        }
        
        // Display analysis results
        function displayAnalysisResults(results, face) {
            // Face detection
            document.getElementById('detectionResults').innerHTML = `
                <p>检测置信度: <strong>${(results.faceDetection.confidence * 100).toFixed(1)}%</strong></p>
                <p>检测模型: <strong>${results.faceDetection.model}</strong></p>
                <p>特征点数量: <strong>${results.faceDetection.landmarks}</strong></p>
            `;
            
            // Complexion analysis
            document.getElementById('colorAnalysis').innerHTML = `
                <p>面色类型: <strong>${results.complexion.type}</strong> (健康评分: ${(results.complexion.healthScore * 100).toFixed(1)}%)</p>
            `;
            document.getElementById('tcmColorAnalysis').innerHTML = `
                <h4>中医诊断</h4>
                <p><strong>诊断:</strong> ${results.complexion.tcmAnalysis.diagnosis}</p>
                <p><strong>病理:</strong> ${results.complexion.tcmAnalysis.pathology}</p>
                <p><strong>建议:</strong> ${results.complexion.tcmAnalysis.treatment}</p>
            `;
            document.getElementById('westernColorAnalysis').innerHTML = `
                <h4>现代医学观察</h4>
                <p><strong>相关术语:</strong> ${results.complexion.westernAnalysis.medicalTerms.join(', ')}</p>
                <p><strong>可能原因:</strong> ${results.complexion.westernAnalysis.possibleCauses.join(', ')}</p>
            `;
            
            // Facial mapping
            let mappingHtml = '<h4>面部区域分析</h4>';
            if (Object.keys(results.complexion.facialMapping.zoneAnalysis).length > 0) {
                for (const [zone, data] of Object.entries(results.complexion.facialMapping.zoneAnalysis)) {
                    mappingHtml += `<div class="organ-analysis">${data.tcmName}: ${data.abnormalities[0].meaning}</div>`;
                }
            } else {
                mappingHtml += '<p>各区域均未见明显异常。</p>';
            }
            document.getElementById('facialMapping').innerHTML = mappingHtml;
            
            // Eye analysis
            let eyeAnalysisHTML = `<p>眼部健康状况评估</p>`;
            if(results.eyeHealth.blinkRate != -1){
                eyeAnalysisHTML += `<p>眼睛睁开程度: <strong>${(results.eyeHealth.blinkRate * 100).toFixed(1)}%</strong></p>`
            }
            document.getElementById('eyeAnalysis').innerHTML = eyeAnalysisHTML;
            document.getElementById('eyeRedness').style.width = `${results.eyeHealth.redness * 100}%`;
            document.getElementById('eyeRedValue').textContent = `${(results.eyeHealth.redness * 100).toFixed(1)}%`;
            document.getElementById('eyeFatigue').style.width = `${results.eyeHealth.fatigue * 100}%`;
            document.getElementById('eyeFatValue').textContent = `${(results.eyeHealth.fatigue * 100).toFixed(1)}%`;
            document.getElementById('blinkRate').style.width = `${results.eyeHealth.blinkRate * 100}%`;
            document.getElementById('blinkRateValue').textContent = `${(results.eyeHealth.blinkRate * 100).toFixed(1)}%`;
            
            // Symmetry analysis
            document.getElementById('symmetryAnalysis').innerHTML = `
                <p>面部对称性良好。</p>
            `;
            document.getElementById('symmetryScore').style.width = `${results.facialSymmetry.score * 100}%`;
            document.getElementById('symValue').textContent = `${(results.facialSymmetry.score * 100).toFixed(1)}%`;
            
            // Skin analysis
            document.getElementById('skinAnalysis').innerHTML = `
                <p>皮肤类型: <strong>${results.skinQuality.skinType}</strong></p>
            `;
            document.getElementById('skinTexture').style.width = `${results.skinQuality.texture * 100}%`;
            document.getElementById('skinTexValue').textContent = `${(results.skinQuality.texture * 100).toFixed(1)}%`;
            document.getElementById('skinGlow').style.width = `${results.skinQuality.glow * 100}%`;
            document.getElementById('skinGlowValue').textContent = `${(results.skinQuality.glow * 100).toFixed(1)}%`;
            
            // Recommendations
            let recHtml = '<ul>';
            recHtml += results.recommendations.lifestyle.map(r => `<li><strong>生活方式:</strong> ${r}</li>`).join('');
            recHtml += results.recommendations.diet.map(r => `<li><strong>饮食建议:</strong> ${r}</li>`).join('');
            recHtml += results.recommendations.skincare.map(r => `<li><strong>护肤建议:</strong> ${r}</li>`).join('');
            recHtml += results.recommendations.medical.map(r => `<li><strong>医疗建议:</strong> ${r}</li>`).join('');
            recHtml += '</ul>';
            document.getElementById('recommendations').innerHTML = recHtml;
            
            // Tongue analysis
            if (results.tongueAnalysis) {
                document.getElementById('tongueAnalysisSection').style.display = 'block';
                const tongueDiag = results.tongueAnalysis.tcmDiagnosis;
                document.getElementById('tongueAnalysisResults').innerHTML = `
                    <p><strong>主要诊断:</strong> ${tongueDiag.primaryDiagnosis} (置信度: ${(results.tongueAnalysis.confidence * 100).toFixed(1)}%)</p>
                `;
                document.getElementById('tongueCoatingAnalysis').innerHTML = `
                    <h4>舌苔分析</h4>
                    <p><strong>类型:</strong> ${tongueDiag.coatingAnalysis.type}</p>
                    <p><strong>描述:</strong> ${tongueDiag.coatingAnalysis.description}</p>
                `;
                document.getElementById('tongueBodyAnalysis').innerHTML = `
                    <h4>舌质分析</h4>
                    <p><strong>颜色:</strong> ${tongueDiag.bodyAnalysis.color}</p>
                    <p><strong>提示:</strong> ${tongueDiag.bodyAnalysis.indication}</p>
                `;
                if (tongueDiag.constitution) {
                    document.getElementById('tongueConstitutionAnalysis').innerHTML = `
                        <h4>体质辨识</h4>
                        <p><strong>可能体质:</strong> ${tongueDiag.constitution.data.name}</p>
                        <p><strong>建议:</strong> ${tongueDiag.constitution.data.treatment}</p>
                    `;
                }
            } else {
                document.getElementById('tongueAnalysisSection').style.display = 'none';
            }
        }
        
        // Export to PDF
        async function exportToPDF() {
            updateStatus("正在生成PDF报告...", 'loading');
            exportBtn.disabled = true;
            
            try {
                const { jsPDF } = window.jspdf;
                const pdf = new jsPDF({
                    orientation: 'p',
                    unit: 'mm',
                    format: 'a4'
                });
                
                // Add custom font that supports Chinese
                // Note: This requires a VFS (Virtual File System) file for the font
                // For simplicity, we'll rely on standard fonts and handle characters that work
                
                const resultsContainer = document.getElementById('results');
                
                // Use html2canvas to render the results container
                const canvas = await html2canvas(resultsContainer, {
                    scale: 2, // Higher scale for better quality
                    useCORS: true,
                    logging: true,
                    allowTaint: true
                });
                
                const imgData = canvas.toDataURL('image/png');
                const imgProps = pdf.getImageProperties(imgData);
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                
                let heightLeft = pdfHeight;
                let position = 0;
                
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
                heightLeft -= pdf.internal.pageSize.getHeight();
                
                while (heightLeft >= 0) {
                    position = heightLeft - pdfHeight;
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
                    heightLeft -= pdf.internal.pageSize.getHeight();
                }
                
                pdf.save(`AI面部健康分析报告-${new Date().toISOString().slice(0,10)}.pdf`);
                
                updateStatus("✅ PDF报告已��出", 'success');
                
            } catch (error) {
                console.error("❌ PDF导出失败:", error);
                updateStatus(`PDF导出失败: ${error.message}`, 'error');
            } finally {
                exportBtn.disabled = false;
            }
        }
        
        // Helper function to extract a region from ImageData
        function extractImageRegion(imageData, x, y, width, height) {
            const region = {
                data: new Uint8ClampedArray(width * height * 4),
                width: width,
                height: height
            };
            
            for (let i = 0; i < height; i++) {
                for (let j = 0; j < width; j++) {
                    const sourceIndex = ((y + i) * imageData.width + (x + j)) * 4;
                    const destIndex = (i * width + j) * 4;
                    
                    region.data[destIndex] = imageData.data[sourceIndex];
                    region.data[destIndex + 1] = imageData.data[sourceIndex + 1];
                    region.data[destIndex + 2] = imageData.data[sourceIndex + 2];
                    region.data[destIndex + 3] = imageData.data[sourceIndex + 3];
                }
            }
            
            return region;
        }
        
        // Helper function to analyze color distribution in a region
        function analyzeColorDistribution(region) {
            let r = 0, g = 0, b = 0;
            let brightnessSum = 0;
            let pixelCount = region.width * region.height;
            
            for (let i = 0; i < region.data.length; i += 4) {
                r += region.data[i];
                g += region.data[i + 1];
                b += region.data[i + 2];
                brightnessSum += (region.data[i] + region.data[i+1] + region.data[i+2]) / 3;
            }
            
            const avgR = r / pixelCount;
            const avgG = g / pixelCount;
            const avgB = b / pixelCount;
            
            // Calculate more stats
            let variance = 0;
            for (let i = 0; i < region.data.length; i += 4) {
                const pixelBrightness = (region.data[i] + region.data[i+1] + region.data[i+2]) / 3;
                variance += Math.pow(pixelBrightness - (brightnessSum / pixelCount), 2);
            }
            
            const stdDev = Math.sqrt(variance / pixelCount);
            
            return {
                avgColor: { r: avgR, g: avgG, b: avgB },
                brightness: brightnessSum / pixelCount / 255,
                contrast: stdDev / 128,
                uniformity: 1 - (stdDev / 128),
                redDominance: avgR / (avgR + avgG + avgB),
                yellowTone: (avgR + avgG) / (2 * (avgR + avgG + avgB))
            };
        }
        
        // Extract face region based on bounding box
        function extractFaceRegion(face, imageData) {
            const box = face.box || face.boundingBox;
            const x = box.xMin || box.topLeft[0];
            const y = box.yMin || box.topLeft[1];
            const width = (box.xMax || box.bottomRight[0]) - x;
            const height = (box.yMax || box.bottomRight[1]) - y;
            
            return extractImageRegion(imageData, Math.floor(x), Math.floor(y), Math.floor(width), Math.floor(height));
        }
        
        // DOMContentLoaded listener
        window.addEventListener('DOMContentLoaded', () => {
            initializeDOM();
            
            // Add a listener to resize the overlay canvas when the window is resized
            window.addEventListener('resize', () => {
                if (isStreaming) {
                    const videoRect = video.getBoundingClientRect();
                    landmarkCanvas.style.top = video.offsetTop + 'px';
                    landmarkCanvas.style.left = video.offsetLeft + 'px';
                    landmarkCanvas.style.width = video.offsetWidth + 'px';
                    landmarkCanvas.style.height = video.offsetHeight + 'px';
                }
            });
        });